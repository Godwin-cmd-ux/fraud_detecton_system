import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import type supertest from 'supertest';
import { transactions, users } from '../../src/db/schema';
import { minutesAgo } from '../../src/lib/time';
import { ML_FALLBACK } from '../../src/modules/fraud/rules';
import { loginAs, makeTestApp } from '../helpers/app';
import type { TestApp } from '../helpers/app';
import { closeTestDb, testPool, truncateAll } from '../helpers/db';
import { createUser, insertTx } from '../helpers/fixtures';
import { mlMock } from '../helpers/mlMock';

// 12:00 UTC is 15:00 in Dar es Salaam: a normal hour.
const NOON = new Date('2026-10-29T12:00:00Z');
// 02:30 UTC is 05:30 in Dar es Salaam: an unusual hour.
const EARLY = new Date('2026-10-29T02:30:00Z');

let t: TestApp;
let A: Awaited<ReturnType<typeof createUser>>;
let B: Awaited<ReturnType<typeof createUser>>;
let agent: supertest.Agent;

async function setup(opts: Parameters<typeof makeTestApp>[0] = {}) {
  t = await makeTestApp({ now: NOON, ...opts });
  await truncateAll(t.db);
  A = await createUser(t.db, { fullName: 'Amina Hassan', balance: 5_000_000 });
  B = await createUser(t.db, { fullName: 'Baraka Mushi', balance: 1_000_000 });
  agent = await loginAs(t, 'user', A.email, A.password);
}

const send = (body: Record<string, unknown>) =>
  agent.post('/api/me/transfers').send({ receiverId: B.id, amount: 100_000, location: 'Dar es Salaam', ...body });

const balanceOf = async (id: number) => {
  const [row] = await t.db.select({ balance: users.balance }).from(users).where(eq(users.id, id));
  return row!.balance;
};
const lastTx = async () => {
  const [row] = await t.db.select().from(transactions).orderBy(sql`id desc`).limit(1);
  return row;
};
const txCount = async () => {
  const r = await t.db.execute(sql`select count(*)::int as c from transactions`);
  return (r.rows[0] as { c: number }).c;
};

afterAll(closeTestDb);

describe('transfer happy path and validation', () => {
  beforeEach(() => setup());

  it('moves money, records the transaction with features, and updates location', async () => {
    const res = await send({ amount: 100_000, location: 'Arusha', message: 'rent' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      outcome: 'success',
      newBalance: 4_900_000,
      riskScore: 0,
      riskLevel: 'LOW',
      flaggedForReview: false,
      fraudPrediction: 'LEGIT',
      message: 'Transaction successful! You sent TSh 100,000.00 to Baraka Mushi',
    });
    expect(await balanceOf(A.id)).toBe('4900000.00');
    expect(await balanceOf(B.id)).toBe('1100000.00');
    const tx = await lastTx();
    // The response carries the stored timestamp so the client can issue a receipt.
    expect(res.body.createdAt).toBe(tx!.createdAt.toISOString());
    expect(tx).toMatchObject({
      status: 'SUCCESS',
      transactionType: 'transfer',
      fraudScore: '0.00',
      fraudPrediction: 'LEGIT',
      riskLevel: 'LOW',
      senderName: 'Amina Hassan',
      receiverName: 'Baraka Mushi',
      message: 'rent',
      transactionLocation: 'Arusha',
      modelVersion: '1.0.0',
    });
    expect(Object.keys(tx!.featureData as object)).toHaveLength(11);
    const [a] = await t.db.select({ loc: users.lastKnownLocation }).from(users).where(eq(users.id, A.id));
    expect(a!.loc).toBe('Arusha');
  });

  it('rejects invalid amounts without writing anything', async () => {
    for (const amount of [1000.005, 'abc', -5, 0]) {
      const res = await send({ amount });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    }
    expect(await txCount()).toBe(0);
  });

  it('rejects self-transfer, insufficient balance and inactive receivers', async () => {
    const self = await send({ receiverId: A.id });
    expect(self.status).toBe(400);
    expect(self.body.error.message).toContain('You cannot send money to yourself');

    const poor = await send({ amount: 6_000_000 });
    expect(poor.body.error.message).toContain('Insufficient balance. Your balance is TSh 5,000,000.00');

    await t.db.update(users).set({ isActive: false }).where(eq(users.id, B.id));
    const inactive = await send({});
    expect(inactive.status).toBe(400);
    expect(inactive.body.error.message).toContain('Invalid receiver selected');
    expect(await txCount()).toBe(0);
  });
});

describe('velocity patterns', () => {
  beforeEach(() => setup());

  it('Pattern 1 blocks the third large transfer over 10M and then everything in the window', async () => {
    await insertTx(t.db, { senderId: A.id, receiverId: B.id, amount: 4_000_000, createdAt: minutesAgo(NOON, 3) });
    await insertTx(t.db, { senderId: A.id, receiverId: B.id, amount: 5_000_000, createdAt: minutesAgo(NOON, 2) });
    const res = await send({ amount: 1_500_000 });
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('blocked');
    expect(res.body.riskScore).toBe(85);
    expect(res.body.reason).toContain('You have made 3 large transactions totaling TSh 10,500,000.00');
    const tx = await lastTx();
    expect(tx!.status).toBe('ABORTED');
    expect(tx!.message).toMatch(/^BLOCKED: Large transaction volume - 3 large transactions totaling TSh 10,500,000\.00/);
    expect(await balanceOf(A.id)).toBe('5000000.00');

    const tiny = await send({ amount: 100 });
    expect(tiny.body.outcome).toBe('blocked');
  });

  it('Pattern 1 ignores large transfers older than 5 minutes', async () => {
    await insertTx(t.db, { senderId: A.id, receiverId: B.id, amount: 4_000_000, createdAt: minutesAgo(NOON, 6) });
    await insertTx(t.db, { senderId: A.id, receiverId: B.id, amount: 5_000_000, createdAt: minutesAgo(NOON, 7) });
    const res = await send({ amount: 1_500_000 });
    expect(res.body.outcome).toBe('success');
  });

  it('Pattern 2 allows a repeat receiver but blocks the fourth distinct one', async () => {
    const C = await createUser(t.db);
    const D = await createUser(t.db);
    const E = await createUser(t.db);
    for (const r of [B, C, D]) {
      await insertTx(t.db, { senderId: A.id, receiverId: r.id, amount: 1000, createdAt: minutesAgo(NOON, 1) });
    }
    const repeat = await send({ receiverId: B.id, amount: 1000 });
    expect(repeat.body.outcome).toBe('success');

    const res = await send({ receiverId: E.id, amount: 1000 });
    expect(res.body.outcome).toBe('blocked');
    expect(res.body.riskScore).toBe(90);
    expect((await lastTx())!.message).toContain('(max: 4)');

    // The blocked attempt is recorded, so it counts too: even the repeat is now blocked (original behaviour).
    const after = await send({ receiverId: B.id, amount: 1000 });
    expect(after.body.outcome).toBe('blocked');
  });

  it('Pattern 3 blocks the third distinct sender to one receiver', async () => {
    const C = await createUser(t.db);
    const D = await createUser(t.db);
    await insertTx(t.db, { senderId: C.id, receiverId: B.id, amount: 1000, createdAt: minutesAgo(NOON, 6) });
    await insertTx(t.db, { senderId: D.id, receiverId: B.id, amount: 1000, createdAt: minutesAgo(NOON, 1) });
    const res = await send({ amount: 1000 });
    expect(res.body.outcome).toBe('blocked');
    expect(res.body.riskScore).toBe(90);
    expect((await lastTx())!.message).toMatch(/^BLOCKED: Receiver has 2 unique senders in 7 minutes/);

    await insertTx(t.db, { senderId: A.id, receiverId: B.id, amount: 1000, createdAt: minutesAgo(NOON, 8) });
    const F = await createUser(t.db, { balance: 10_000 });
    const fAgent = await loginAs(t, 'user', F.email, F.password);
    const other = await fAgent.post('/api/me/transfers').send({ receiverId: C.id, amount: 1000, location: 'Dar es Salaam' });
    expect(other.body.outcome).toBe('success');
  });
});

describe('ML integration', () => {
  it('degrades gracefully when the service is down', async () => {
    await setup({ ml: mlMock('down') });
    const res = await send({});
    expect(res.body).toMatchObject({ outcome: 'success', riskScore: 0 });
    expect((await lastTx())!.modelVersion).toBe('1.0.0');
  });

  it('stores a medium score and flags for review', async () => {
    await setup({ ml: mlMock({ ...ML_FALLBACK, riskScore: 65, prediction: 'FRAUD', riskLevel: 'MEDIUM', predictionTime: NOON }) });
    const res = await send({});
    expect(res.body).toMatchObject({ outcome: 'success', riskScore: 65, flaggedForReview: true, fraudPrediction: 'FRAUD' });
    expect(await lastTx()).toMatchObject({ fraudScore: '65.00', fraudPrediction: 'FRAUD', riskLevel: 'MEDIUM' });
  });

  it('never blocks on a high ML score alone', async () => {
    await setup({ ml: mlMock({ ...ML_FALLBACK, riskScore: 95, prediction: 'FRAUD', riskLevel: 'HIGH' }) });
    const res = await send({});
    expect(res.body).toMatchObject({ outcome: 'success', riskScore: 95, flaggedForReview: false });
  });
});

describe('rule overrides', () => {
  beforeEach(() => setup());

  it('blocks after three aborted withdrawals in 10 minutes', async () => {
    for (let i = 0; i < 3; i++) {
      await insertTx(t.db, { senderId: A.id, transactionType: 'withdrawal', status: 'ABORTED', amount: 1000, createdAt: minutesAgo(NOON, 5) });
    }
    const res = await send({});
    expect(res.body).toMatchObject({ outcome: 'blocked', riskScore: 85, reason: 'Multiple failed withdrawal attempts detected' });
    expect(res.body.message).toContain('❌ Transaction BLOCKED due to fraud detection.');
    expect((await lastTx())!.message).toBe('BLOCKED: Multiple failed withdrawal attempts detected | ');
  });

  it('blocks large transfers before 06:00 Dar time', async () => {
    t.clock.now = EARLY;
    const res = await send({ amount: 1_500_000 });
    expect(res.body).toMatchObject({ outcome: 'blocked', riskScore: 80 });
    t.clock.now = new Date('2026-10-29T03:00:00Z');
    const six = await send({ amount: 1_500_000 });
    expect(six.body.outcome).toBe('success');
  });

  it('blocks a far location change with a large amount', async () => {
    await insertTx(t.db, { senderId: A.id, receiverId: B.id, amount: 100, transactionLocation: 'Dar es Salaam', createdAt: minutesAgo(NOON, 2) });
    const blocked = await send({ amount: 600_000, location: 'Mwanza' });
    expect(blocked.body).toMatchObject({ outcome: 'blocked', riskScore: 100, reason: 'Suspicious location change with large transaction' });
    expect(blocked.body.locationWarning).toMatch(/Location changed from Dar es Salaam to Mwanza/);
  });

  it('adds the location score and flags a smaller transfer for review', async () => {
    await insertTx(t.db, { senderId: A.id, receiverId: B.id, amount: 100, transactionLocation: 'Dar es Salaam', createdAt: minutesAgo(NOON, 2) });
    const warned = await send({ amount: 400_000, location: 'Mwanza' });
    expect(warned.body).toMatchObject({ outcome: 'success', riskScore: 60, flaggedForReview: true });
    expect(warned.body.locationWarning).toBeDefined();
  });

  it('blocks extreme amounts', async () => {
    await t.db.update(users).set({ balance: '20000000.00' }).where(eq(users.id, A.id));
    const res = await send({ amount: 10_000_001 });
    expect(res.body).toMatchObject({ outcome: 'blocked', riskScore: 90, reason: 'Transaction amount exceeds security threshold' });
  });
});

describe('atomicity', () => {
  it('concurrent transfers cannot overdraw', async () => {
    await setup();
    await t.db.update(users).set({ balance: '1000.00' }).where(eq(users.id, A.id));
    const [r1, r2] = await Promise.all([send({ amount: 800 }), send({ amount: 800 })]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses[0]).toBe(200);
    expect([400, 409]).toContain(statuses[1]);
    expect(await balanceOf(A.id)).toBe('200.00');
    const ok = await t.db.execute(sql`select count(*)::int as c from transactions where status = 'SUCCESS'`);
    expect(ok.rows[0]).toEqual({ c: 1 });
  });

  it('returns 409 and rolls back when the balance drops between validation and debit', async () => {
    await setup();
    await t.db.update(users).set({ balance: '1000.00' }).where(eq(users.id, A.id));
    // Hold a row lock so the transfer's debit must wait, then shrink the balance before releasing it.
    const client = await testPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [A.id]);
      // superagent is lazy: calling .then() actually sends the request.
      const pending = send({ amount: 800 }).then((r) => r);
      await new Promise((r) => setTimeout(r, 500));
      await client.query('UPDATE users SET balance = 100 WHERE id = $1', [A.id]);
      await client.query('COMMIT');
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ code: 'DEBIT_FAILED', message: 'Failed to deduct balance' });
    } finally {
      client.release();
    }
    expect(await balanceOf(A.id)).toBe('100.00');
    expect(await txCount()).toBe(0);
  });
});
