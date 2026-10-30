import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import type supertest from 'supertest';
import { failedWithdrawalAttempts, transactions, users } from '../../src/db/schema';
import { hoursAgo, minutesAgo } from '../../src/lib/time';
import { ML_FALLBACK } from '../../src/modules/fraud/rules';
import { loginAs, makeTestApp } from '../helpers/app';
import type { TestApp } from '../helpers/app';
import { closeTestDb, truncateAll } from '../helpers/db';
import { createUser, insertTx } from '../helpers/fixtures';
import { mlMock } from '../helpers/mlMock';

const NOON = new Date('2026-10-29T12:00:00Z');
const EARLY = new Date('2026-10-29T02:00:00Z');

let t: TestApp;
let A: Awaited<ReturnType<typeof createUser>>;
let agent: supertest.Agent;
let ml: ReturnType<typeof mlMock>;

beforeEach(async () => {
  ml = mlMock(ML_FALLBACK);
  t = await makeTestApp({ now: NOON, ml });
  await truncateAll(t.db);
  A = await createUser(t.db, { fullName: 'Amina Hassan', balance: 1_000_000 });
  agent = await loginAs(t, 'user', A.email, A.password);
});
afterAll(closeTestDb);

const withdraw = (body: Record<string, unknown> = {}) =>
  agent.post('/api/me/withdrawals').send({ amount: 50_000, location: 'Dar es Salaam', ...body });

const balanceOf = async () => {
  const [row] = await t.db.select({ balance: users.balance }).from(users).where(eq(users.id, A.id));
  return row!.balance;
};
const lastTx = async () => {
  const [row] = await t.db.select().from(transactions).orderBy(sql`id desc`).limit(1);
  return row;
};

describe('withdrawal happy path and validation', () => {
  it('debits the balance and records a withdrawal row', async () => {
    const res = await withdraw({ message: 'rent' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      outcome: 'success',
      // 1,000,000 - 50,000 - 1.1% fee (550.00).
      newBalance: 949_450,
      message: 'Withdrawal successful! You withdrew TSh 50,000.00',
      fraudPrediction: 'LEGIT',
    });
    expect(await balanceOf()).toBe('949450.00');
    expect(res.body.createdAt).toBe((await lastTx())!.createdAt.toISOString());
    expect(await lastTx()).toMatchObject({
      transactionType: 'withdrawal',
      status: 'SUCCESS',
      senderId: A.id,
      receiverId: null,
      fee: '550.00',
      message: 'rent',
    });
  });

  it('enforces the minimum amount', async () => {
    const res = await withdraw({ amount: 999 });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Minimum withdrawal amount is TSh 1,000');
  });
});

describe('insufficient balance attempts', () => {
  it('records each failed attempt, escalates the score, and blocks on the third', async () => {
    const first = await withdraw({ amount: 2_000_000 });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({
      outcome: 'failed',
      message: 'Insufficient balance. Please try a lower amount.',
      failedAttempts: 1,
      blocked: false,
    });
    expect(await lastTx()).toMatchObject({
      status: 'ABORTED',
      fraudPrediction: 'PENDING',
      riskLevel: 'MEDIUM',
      fraudScore: '60.00',
      message: 'FAILED: Insufficient balance (Attempt 1) | ',
    });
    expect(ml.calls).toHaveLength(0);

    const second = await withdraw({ amount: 2_000_000 });
    expect(second.body.failedAttempts).toBe(2);
    expect((await lastTx())!.fraudScore).toBe('70.00');

    const third = await withdraw({ amount: 2_000_000 });
    expect(third.body).toMatchObject({ failedAttempts: 3, blocked: true });

    const locked = await withdraw({ amount: 50_000 });
    expect(locked.body.outcome).toBe('blocked');
    expect(locked.body.riskScore).toBe(95);
    expect((await lastTx())!.message).toMatch(/^BLOCKED: User has 3 consecutive failed withdrawal attempts/);
    expect(await balanceOf()).toBe('1000000.00');
  });

  it('releases the block after 24 hours and resets on success', async () => {
    for (let i = 0; i < 3; i++) await withdraw({ amount: 2_000_000 });
    await t.db
      .update(failedWithdrawalAttempts)
      .set({ lastAttemptTime: hoursAgo(NOON, 25) })
      .where(eq(failedWithdrawalAttempts.userId, A.id));
    const ok = await withdraw({ amount: 50_000 });
    expect(ok.body.outcome).toBe('success');
    const [row] = await t.db.select().from(failedWithdrawalAttempts).where(eq(failedWithdrawalAttempts.userId, A.id));
    expect(row!.attemptCount).toBe(0);
  });

  it('a successful withdrawal resets a partial count', async () => {
    await withdraw({ amount: 2_000_000 });
    await withdraw({ amount: 2_000_000 });
    await withdraw({ amount: 50_000 });
    const [row] = await t.db.select().from(failedWithdrawalAttempts).where(eq(failedWithdrawalAttempts.userId, A.id));
    expect(row!.attemptCount).toBe(0);
  });
});

describe('withdrawal rules', () => {
  it('blocks after multiple large transactions in a short period', async () => {
    for (const amt of [4_000_000, 4_000_000, 2_000_001]) {
      await insertTx(t.db, { senderId: A.id, amount: amt, createdAt: minutesAgo(NOON, 2) });
    }
    const res = await withdraw();
    expect(res.body).toMatchObject({ outcome: 'blocked', riskScore: 85, reason: 'Multiple large transactions detected in short period' });
    expect(res.body.message).toContain('❌ Withdrawal BLOCKED due to fraud detection.');
  });

  it('blocks large withdrawals before 06:00', async () => {
    await t.db.update(users).set({ balance: '5000000.00' }).where(eq(users.id, A.id));
    t.clock.now = EARLY;
    const res = await withdraw({ amount: 1_500_000 });
    expect(res.body).toMatchObject({ outcome: 'blocked', riskScore: 85 });
  });

  it('blocks a far location change with a large withdrawal', async () => {
    await insertTx(t.db, { senderId: A.id, amount: 100, transactionLocation: 'Dar es Salaam', createdAt: minutesAgo(NOON, 2) });
    const res = await withdraw({ amount: 600_000, location: 'Mwanza' });
    expect(res.body).toMatchObject({ outcome: 'blocked', riskScore: 100, reason: 'Suspicious location change with large withdrawal' });
    expect(res.body.locationWarning).toBeUndefined();
  });

  it('blocks withdrawing over 90% of the balance when large', async () => {
    await t.db.update(users).set({ balance: '1600000.00' }).where(eq(users.id, A.id));
    const res = await withdraw({ amount: 1_500_000 });
    expect(res.body).toMatchObject({ outcome: 'blocked', riskScore: 80, reason: 'Attempting to withdraw more than 90% of balance' });
  });

  it('blocks extreme withdrawals', async () => {
    await t.db.update(users).set({ balance: '20000000.00' }).where(eq(users.id, A.id));
    const res = await withdraw({ amount: 10_000_001 });
    expect(res.body).toMatchObject({ outcome: 'blocked', riskScore: 90, reason: 'Withdrawal amount exceeds security threshold' });
  });
});
