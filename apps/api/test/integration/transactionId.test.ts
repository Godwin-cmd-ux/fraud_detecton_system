import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type { Db } from '../../src/db/client';
import { insertTransaction } from '../../src/modules/transactions/repo';
import type { NewTransaction } from '../../src/modules/transactions/repo';
import { closeTestDb, setupTestDb, truncateAll } from '../helpers/db';
import { createUser } from '../helpers/fixtures';

let db: Db;
beforeEach(async () => {
  db = await setupTestDb();
  await truncateAll(db);
});
afterAll(closeTestDb);

const row = (transactionId: string, senderId: number): NewTransaction => ({
  transactionId,
  senderId,
  receiverId: null,
  senderName: 'A',
  receiverName: null,
  amount: 10,
  transactionType: 'withdrawal',
  status: 'SUCCESS',
  message: null,
  fraudScore: 0,
  fraudPrediction: null,
  riskLevel: null,
  predictionTime: null,
  modelVersion: null,
  featureData: null,
  transactionLocation: null,
  ipAddress: null,
  userAgent: null,
  adminId: null,
});

describe('insertTransaction', () => {
  it('retries with a fresh id when the transaction id collides', async () => {
    const A = await createUser(db);
    const dup = 'TXN202610291200001234';
    const first = await insertTransaction(db, row(dup, A.id));
    expect(first.transactionId).toBe(dup);

    const second = await insertTransaction(db, row(dup, A.id));
    expect(second.transactionId).not.toBe(dup);
    expect(second.transactionId).toMatch(/^TXN\d{18}$/);
    const count = await db.execute(sql`select count(*)::int as c from transactions`);
    expect(count.rows[0]).toEqual({ c: 2 });
  });

  it('survives a collision inside an enclosing database transaction', async () => {
    const A = await createUser(db);
    const dup = 'TXN202610291200009999';
    await insertTransaction(db, row(dup, A.id));
    await db.transaction(async (tx) => {
      await insertTransaction(tx, row(dup, A.id));
      await insertTransaction(tx, row('TXN202610291200000001', A.id));
    });
    const count = await db.execute(sql`select count(*)::int as c from transactions`);
    expect(count.rows[0]).toEqual({ c: 3 });
  });
});
