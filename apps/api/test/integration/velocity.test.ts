import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../../src/db/client';
import { failedWithdrawalAttempts, users } from '../../src/db/schema';
import { minutesAgo, hoursAgo } from '../../src/lib/time';
import {
  getFailedWithdrawalCount,
  getLocationChange,
  getVelocityContext,
  incrementFailedWithdrawal,
  resetFailedWithdrawals,
} from '../../src/modules/fraud/velocity';
import { debitBalance } from '../../src/modules/transactions/repo';
import { closeTestDb, setupTestDb, truncateAll } from '../helpers/db';
import { createUser, insertTx } from '../helpers/fixtures';

let db: Db;
const now = new Date('2026-10-29T12:00:00Z');

beforeAll(async () => {
  db = await setupTestDb();
});
afterAll(closeTestDb);
beforeEach(async () => {
  await truncateAll(db);
});

describe('getVelocityContext', () => {
  it('counts the sender windows including aborted rows', async () => {
    const A = await createUser(db);
    const B = await createUser(db);
    const C = await createUser(db);
    const D = await createUser(db);
    const E = await createUser(db);

    await insertTx(db, { senderId: A.id, receiverId: B.id, amount: 1_500_000, createdAt: minutesAgo(now, 2) });
    await insertTx(db, { senderId: A.id, receiverId: C.id, amount: 2_000_000, status: 'ABORTED', createdAt: minutesAgo(now, 4) });
    await insertTx(db, { senderId: A.id, receiverId: D.id, amount: 500, createdAt: minutesAgo(now, 6) });
    await insertTx(db, { senderId: A.id, receiverId: null, amount: 100, transactionType: 'withdrawal', status: 'ABORTED', createdAt: minutesAgo(now, 3) });
    await insertTx(db, { senderId: E.id, receiverId: A.id, amount: 100, createdAt: minutesAgo(now, 1) });

    const ctx = await getVelocityContext(db, { senderId: A.id, receiverId: B.id, now });
    expect(ctx).toMatchObject({
      transactionCountLast5Min: 3,
      amountLast5Min: 3_500_100,
      largeCountLast5Min: 2,
      largeSumLast5Min: 3_500_000,
      uniqueReceiversLast5Min: 2,
      receiverAlreadyInWindow: true,
      uniqueSendersLast5Min: 1,
      failedWithdrawalsLast10Min: 1,
    });
    expect(ctx.avgUserAmount).toBeCloseTo((1_500_000 + 500) / 2, 2);

    const toD = await getVelocityContext(db, { senderId: A.id, receiverId: D.id, now });
    expect(toD.receiverAlreadyInWindow).toBe(false);

    // Receiver-side: A has one distinct sender (E) in the last 7 minutes; B has not sent to A.
    const bToA = await getVelocityContext(db, { senderId: B.id, receiverId: A.id, now });
    expect(bToA.uniqueSendersToReceiverLast7Min).toBe(1);
    expect(bToA.senderAlreadyInReceiverWindow).toBe(false);
  });
});

describe('getLocationChange', () => {
  it('detects a change against the last located transaction within 5 minutes', async () => {
    const A = await createUser(db);
    await insertTx(db, { senderId: A.id, amount: 100, transactionLocation: 'Dar es Salaam', createdAt: minutesAgo(now, 2) });
    const change = await getLocationChange(db, { userId: A.id, newLocation: 'Mwanza', now });
    expect(change.changed).toBe(true);
    expect(change.previousLocation).toBe('Dar es Salaam');
    expect(Math.abs((change.distanceKm ?? 0) - 843)).toBeLessThanOrEqual(5);
    const same = await getLocationChange(db, { userId: A.id, newLocation: 'Dar es Salaam', now });
    expect(same.changed).toBe(false);
  });

  it('ignores transactions older than the window', async () => {
    const A = await createUser(db);
    await insertTx(db, { senderId: A.id, amount: 100, transactionLocation: 'Dar es Salaam', createdAt: minutesAgo(now, 6) });
    const change = await getLocationChange(db, { userId: A.id, newLocation: 'Mwanza', now });
    expect(change.changed).toBe(false);
  });
});

describe('failed withdrawal counter', () => {
  it('increments, resets after 24 hours, and resets on demand', async () => {
    const A = await createUser(db);
    expect(await incrementFailedWithdrawal(db, A.id, now)).toBe(1);
    expect(await incrementFailedWithdrawal(db, A.id, now)).toBe(2);
    expect(await getFailedWithdrawalCount(db, A.id, now)).toBe(2);

    await db
      .update(failedWithdrawalAttempts)
      .set({ lastAttemptTime: hoursAgo(now, 25) })
      .where(eq(failedWithdrawalAttempts.userId, A.id));
    expect(await getFailedWithdrawalCount(db, A.id, now)).toBe(0);

    await incrementFailedWithdrawal(db, A.id, now);
    await resetFailedWithdrawals(db, A.id);
    expect(await getFailedWithdrawalCount(db, A.id, now)).toBe(0);
  });
});

describe('debitBalance', () => {
  it('refuses to overdraw and leaves the balance unchanged', async () => {
    const A = await createUser(db, { balance: 1000 });
    expect(await debitBalance(db, A.id, 1500)).toBe(false);
    const [row] = await db.select({ balance: users.balance }).from(users).where(eq(users.id, A.id));
    expect(row!.balance).toBe('1000.00');
    expect(await debitBalance(db, A.id, 400)).toBe(true);
    const after = await db.execute(sql`select balance from users where id = ${A.id}`);
    expect(after.rows[0]).toEqual({ balance: '600.00' });
  });
});
