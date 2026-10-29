import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import type supertest from 'supertest';
import { adminActions, transactions } from '../../src/db/schema';
import { hoursAgo, minutesAgo } from '../../src/lib/time';
import { loginAs, makeTestApp } from '../helpers/app';
import type { TestApp } from '../helpers/app';
import { closeTestDb, truncateAll } from '../helpers/db';
import { createAdmin, createUser, insertTx } from '../helpers/fixtures';

const NOW = new Date('2026-10-29T12:00:00Z');

let t: TestApp;
let admin: Awaited<ReturnType<typeof createAdmin>>;
let agent: supertest.Agent;
let A: Awaited<ReturnType<typeof createUser>>;
let B: Awaited<ReturnType<typeof createUser>>;
let ids: Record<string, number>;

beforeEach(async () => {
  t = await makeTestApp({ now: NOW });
  await truncateAll(t.db);
  admin = await createAdmin(t.db, { fullName: 'Root Admin', username: 'root' });
  agent = await loginAs(t, 'admin', admin.username, admin.password);
  A = await createUser(t.db, { fullName: 'Amina Hassan', createdAt: hoursAgo(NOW, 1) });
  B = await createUser(t.db, { fullName: 'Baraka Mushi', createdAt: hoursAgo(NOW, 48) });
  await createUser(t.db, { fullName: 'Pending Person', isApproved: false, createdAt: hoursAgo(NOW, 2) });

  ids = {};
  ids.fraud60 = (await insertTx(t.db, { senderId: A.id, receiverId: B.id, senderName: 'Amina Hassan', receiverName: 'Baraka Mushi', amount: 1000, fraudScore: 60, fraudPrediction: 'FRAUD', riskLevel: 'MEDIUM', createdAt: minutesAgo(NOW, 10) })).id;
  ids.fraud80 = (await insertTx(t.db, { senderId: A.id, receiverId: B.id, senderName: 'Amina Hassan', receiverName: 'Baraka Mushi', amount: 2000, fraudScore: 80, fraudPrediction: 'FRAUD', riskLevel: 'HIGH', status: 'ABORTED', message: 'BLOCKED: test | ', createdAt: minutesAgo(NOW, 9) })).id;
  ids.fraud90 = (await insertTx(t.db, { senderId: B.id, receiverId: A.id, senderName: 'Baraka Mushi', receiverName: 'Amina Hassan', amount: 3000, fraudScore: 90, fraudPrediction: 'FRAUD', riskLevel: 'HIGH', status: 'ABORTED', createdAt: minutesAgo(NOW, 8) })).id;
  ids.pending = (await insertTx(t.db, { senderId: A.id, transactionType: 'withdrawal', amount: 500, fraudScore: 60, fraudPrediction: 'PENDING', riskLevel: 'MEDIUM', status: 'ABORTED', createdAt: minutesAgo(NOW, 7) })).id;
  ids.legit1 = (await insertTx(t.db, { senderId: A.id, receiverId: B.id, senderName: 'Amina Hassan', receiverName: 'Baraka Mushi', amount: 100, fraudScore: 10, fraudPrediction: 'LEGIT', riskLevel: 'LOW', transactionLocation: 'Arusha', featureData: { amount: 100, transaction_hour: 15 }, modelVersion: '1.0.0', createdAt: minutesAgo(NOW, 6) })).id;
  ids.legit2 = (await insertTx(t.db, { senderId: B.id, receiverId: A.id, senderName: 'Baraka Mushi', receiverName: 'Amina Hassan', amount: 200, fraudScore: 5, fraudPrediction: 'LEGIT', riskLevel: 'LOW', createdAt: minutesAgo(NOW, 5) })).id;
  ids.oldAborted = (await insertTx(t.db, { senderId: A.id, receiverId: B.id, amount: 50, status: 'ABORTED', createdAt: hoursAgo(NOW, 48) })).id;
  await agent.post(`/api/admin/users/${A.id}/balance`).send({ amount: 5000, type: 'bonus', reason: 'Welcome bonus credit' });
});
afterAll(closeTestDb);

describe('counters and dashboard', () => {
  it('computes the sidebar counters', async () => {
    const res = await agent.get('/api/admin/counters');
    expect(res.body).toEqual({
      newUsers24h: 2,
      pendingUsers: 1,
      aborted24h: 3,
      fraudAlerts: 3,
      highRisk: 2,
      reviewQueue: 1,
    });
  });

  it('computes dashboard KPIs and recent lists', async () => {
    const res = await agent.get('/api/admin/dashboard');
    expect(res.body.kpis).toEqual({
      totalUsers: 3,
      totalTransactions: 8,
      successful: 4,
      aborted: 4,
      moneyMoved: 6300,
      fraudDetected: 3,
      highRisk: 2,
      reviewQueue: 1,
    });
    expect(res.body.recentAlerts.map((r: { id: number }) => r.id)).toEqual([ids.fraud90, ids.fraud80, ids.fraud60]);
    expect(res.body.recentTransactions).toHaveLength(8);
    expect(res.body.recentTransactions[0]).toMatchObject({ type: 'bonus', senderName: null, receiverName: 'Amina Hassan' });
    expect(res.body.recentUsers.map((u: { fullName: string }) => u.fullName)).toEqual(['Amina Hassan', 'Pending Person', 'Baraka Mushi']);
  });
});

describe('transactions listing and details', () => {
  it('searches by party name in both list and count, and filters', async () => {
    const byReceiver = await agent.get('/api/admin/transactions?search=Baraka');
    expect(byReceiver.status).toBe(200);
    expect(byReceiver.body.total).toBe(6);
    expect(byReceiver.body.items).toHaveLength(6);

    expect((await agent.get('/api/admin/transactions?status=ABORTED')).body.total).toBe(4);
    expect((await agent.get('/api/admin/transactions?type=withdrawal')).body.total).toBe(1);
    expect((await agent.get('/api/admin/transactions?riskLevel=HIGH')).body.total).toBe(2);
    expect((await agent.get('/api/admin/transactions?fraud=pending')).body.total).toBe(3);
    expect((await agent.get('/api/admin/transactions?fraud=fraud')).body.total).toBe(3);
    expect((await agent.get('/api/admin/transactions?fraud=legit')).body.total).toBe(2);
  });

  it('returns full details with parties, admin and feature data', async () => {
    const res = await agent.get(`/api/admin/transactions/${ids.legit1}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      transactionId: expect.any(String),
      amount: 100,
      fraudScore: 10,
      location: 'Arusha',
      modelVersion: '1.0.0',
      featureData: { amount: 100, transaction_hour: 15 },
      sender: { id: A.id, fullName: 'Amina Hassan', balance: 1_005_000 },
      receiver: { id: B.id, fullName: 'Baraka Mushi', balance: 1_000_000 },
      admin: null,
      reviewedAt: null,
    });
    const bonus = (await agent.get('/api/admin/transactions?type=deposit')).body;
    expect(bonus.total).toBe(0);
    const list = await agent.get('/api/admin/transactions?search=Amina');
    const bonusRow = list.body.items.find((r: { type: string }) => r.type === 'bonus');
    const details = await agent.get(`/api/admin/transactions/${bonusRow.id}`);
    expect(details.body.admin).toEqual({ id: admin.id, fullName: 'Root Admin', username: 'root' });
    expect((await agent.get('/api/admin/transactions/999999')).status).toBe(404);
  });
});

describe('fraud alerts and review', () => {
  it('lists unreviewed alerts by default and marks them reviewed with an audit row', async () => {
    const list = await agent.get('/api/admin/fraud-alerts');
    expect(list.body.total).toBe(3);
    expect(list.body.items[0]).toMatchObject({ id: ids.fraud90, status: 'ABORTED', reviewedAt: null });

    const review = await agent.post(`/api/admin/transactions/${ids.fraud90}/review`).send({});
    expect(review.status).toBe(200);
    const [row] = await t.db.select().from(transactions).where(eq(transactions.id, ids.fraud90!));
    expect(row!.status).toBe('ABORTED');
    expect(row!.reviewedAt).not.toBeNull();
    expect(row!.reviewedBy).toBe(admin.id);
    const audit = await t.db.select().from(adminActions).where(eq(adminActions.actionType, 'mark_reviewed'));
    expect(audit).toHaveLength(1);

    expect((await agent.get('/api/admin/fraud-alerts')).body.total).toBe(2);
    expect((await agent.get('/api/admin/fraud-alerts?reviewed=all')).body.total).toBe(3);
    expect((await agent.get('/api/admin/fraud-alerts?reviewed=reviewed')).body.total).toBe(1);
    expect((await agent.get('/api/admin/fraud-alerts?riskLevel=HIGH&reviewed=all')).body.total).toBe(2);
    expect((await agent.get('/api/admin/fraud-alerts?search=Baraka')).body.total).toBe(2);
    expect((await agent.get('/api/admin/fraud-alerts?dateFrom=2026-10-30')).body.total).toBe(0);
    expect((await agent.get('/api/admin/fraud-alerts?dateFrom=2026-10-29&dateTo=2026-10-29')).body.total).toBe(2);

    expect((await agent.post(`/api/admin/transactions/${ids.fraud90}/review`).send({})).status).toBe(409);
    expect((await agent.post(`/api/admin/transactions/${ids.legit1}/review`).send({})).status).toBe(404);
  });
});

describe('balance adjustments log', () => {
  it('summarises and filters admin adjustments', async () => {
    await agent.post(`/api/admin/users/${B.id}/balance`).send({ amount: 1000, type: 'refund', reason: 'Refund for failed order' });
    const res = await agent.get('/api/admin/balance-adjustments');
    expect(res.body.total).toBe(2);
    expect(res.body.summary).toMatchObject({ total: 2, totalAmount: 6000, avgAmount: 3000, uniqueUsers: 2, uniqueAdmins: 1 });
    expect(res.body.summary.byType).toEqual(
      expect.arrayContaining([
        { type: 'bonus', count: 1, total: 5000 },
        { type: 'refund', count: 1, total: 1000 },
      ]),
    );
    expect(res.body.items[0]).toMatchObject({
      type: 'refund',
      amount: 1000,
      userName: 'Baraka Mushi',
      userEmail: B.email,
      adminName: 'Root Admin',
      adminUsername: 'root',
      reason: 'Admin adjustment: Refund for failed order',
    });

    expect((await agent.get(`/api/admin/balance-adjustments?adminId=${admin.id}`)).body.total).toBe(2);
    expect((await agent.get('/api/admin/balance-adjustments?adminId=999')).body.total).toBe(0);
    expect((await agent.get('/api/admin/balance-adjustments?type=bonus')).body.total).toBe(1);
    expect((await agent.get('/api/admin/balance-adjustments?search=Refund')).body.total).toBe(1);
    expect((await agent.get('/api/admin/balance-adjustments?dateFrom=2026-10-30')).body.total).toBe(0);

    const admins = await agent.get('/api/admin/admins');
    expect(admins.body).toEqual([{ id: admin.id, fullName: 'Root Admin', username: 'root' }]);
  });
});
