import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { minutesAgo } from '../../src/lib/time';
import { loginAs, makeTestApp } from '../helpers/app';
import type { TestApp } from '../helpers/app';
import { closeTestDb, truncateAll } from '../helpers/db';
import { createUser, insertTx } from '../helpers/fixtures';

const NOON = new Date('2026-10-29T12:00:00Z');

let t: TestApp;
let A: Awaited<ReturnType<typeof createUser>>;
let B: Awaited<ReturnType<typeof createUser>>;
let agent: supertest.Agent;

beforeEach(async () => {
  t = await makeTestApp({ now: NOON });
  await truncateAll(t.db);
  A = await createUser(t.db, { fullName: 'Amina Hassan', balance: 1234.5, lastKnownLocation: 'Arusha' });
  B = await createUser(t.db, { fullName: 'Baraka Mushi' });
  agent = await loginAs(t, 'user', A.email, A.password);
});
afterAll(closeTestDb);

describe('GET /api/me/dashboard', () => {
  it('hides the balance until the password is verified, then reveals it', async () => {
    await insertTx(t.db, { senderId: A.id, receiverId: B.id, receiverName: 'Baraka Mushi', amount: 100, fraudScore: 60, fraudPrediction: 'FRAUD', riskLevel: 'MEDIUM' });
    await insertTx(t.db, { senderId: B.id, receiverId: A.id, senderName: 'Baraka Mushi', amount: 200 });
    await insertTx(t.db, { senderId: A.id, transactionType: 'withdrawal', status: 'ABORTED', amount: 50, fraudScore: 20, fraudPrediction: 'LEGIT', riskLevel: 'LOW' });

    const hidden = await agent.get('/api/me/dashboard');
    expect(hidden.status).toBe(200);
    expect(hidden.body.balance).toBeNull();
    expect(hidden.body.user).toMatchObject({ fullName: 'Amina Hassan', location: 'Arusha' });
    expect(hidden.body.stats).toEqual({ total: 3, successful: 2, aborted: 1, pending: 0, successRate: 67 });
    expect(hidden.body.fraud).toEqual({ analyzed: 2, fraud: 1, legit: 1, avgScore: 40, maxScore: 60 });
    expect(hidden.body.recent).toHaveLength(3);
    expect(hidden.body.recent.map((r: { direction: string }) => r.direction)).toEqual(['withdrawal', 'received', 'sent']);
    expect(hidden.body.recent[2]).toMatchObject({ counterpartyName: 'Baraka Mushi', amount: 100 });

    const wrong = await agent.post('/api/me/verify-password').send({ password: 'nope' });
    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual({ ok: false, message: 'Incorrect password' });

    const ok = await agent.post('/api/me/verify-password').send({ password: A.password });
    expect(ok.body).toEqual({ ok: true });
    const shown = await agent.get('/api/me/dashboard');
    expect(shown.body.balance).toBe(1234.5);

    t.clock.now = new Date(NOON.getTime() + 6 * 60_000);
    expect((await agent.get('/api/me/dashboard')).body.balance).toBeNull();
  });

  it('rate limits password verification', async () => {
    for (let i = 0; i < 5; i++) await agent.post('/api/me/verify-password').send({ password: 'nope' });
    const sixth = await agent.post('/api/me/verify-password').send({ password: 'nope' });
    expect(sixth.status).toBe(429);
  });
});

describe('GET /api/me/transactions', () => {
  it('is locked until unlocked with the password, and relocks after 5 minutes', async () => {
    for (let i = 0; i < 20; i++) {
      await insertTx(t.db, { senderId: A.id, receiverId: B.id, receiverName: 'Baraka Mushi', amount: 1000 + i, createdAt: minutesAgo(NOON, i), status: i === 0 ? 'ABORTED' : 'SUCCESS' });
    }
    await insertTx(t.db, { senderId: B.id, receiverId: A.id, senderName: 'Baraka Mushi', amount: 5, transactionId: 'TXNSEARCHME', createdAt: minutesAgo(NOON, 30) });

    const locked = await agent.get('/api/me/transactions');
    expect(locked.body).toEqual({ locked: true });

    const bad = await agent.post('/api/me/transactions/unlock').send({ password: 'nope' });
    expect(bad.status).toBe(401);
    const good = await agent.post('/api/me/transactions/unlock').send({ password: A.password });
    expect(good.status).toBe(204);

    const page1 = await agent.get('/api/me/transactions');
    expect(page1.body.locked).toBe(false);
    expect(page1.body.items).toHaveLength(15);
    expect(page1.body).toMatchObject({ page: 1, pageSize: 15, total: 21, totalPages: 2 });
    expect(page1.body.items[0].direction).toBe('sent');

    const page2 = await agent.get('/api/me/transactions?page=2');
    expect(page2.body.items).toHaveLength(6);
    expect(page2.body.items[5]).toMatchObject({ direction: 'received', transactionId: 'TXNSEARCHME' });

    const search = await agent.get('/api/me/transactions?search=SEARCHME');
    expect(search.body.total).toBe(1);
    const aborted = await agent.get('/api/me/transactions?status=ABORTED');
    expect(aborted.body.total).toBe(1);
    const pending = await agent.get('/api/me/transactions?fraud=pending');
    expect(pending.body.total).toBe(21);
    const fraud = await agent.get('/api/me/transactions?fraud=fraud');
    expect(fraud.body.total).toBe(0);

    t.clock.now = new Date(NOON.getTime() + 6 * 60_000);
    expect((await agent.get('/api/me/transactions')).body).toEqual({ locked: true });

    await agent.post('/api/me/transactions/unlock').send({ password: A.password });
    expect((await agent.get('/api/me/transactions')).body.locked).toBe(false);
    await agent.post('/api/me/transactions/lock').send({});
    expect((await agent.get('/api/me/transactions')).body).toEqual({ locked: true });
  });
});

describe('contexts', () => {
  it('describes the send form: recipients, locations, limits', async () => {
    await createUser(t.db, { fullName: 'Inactive', isActive: false });
    await createUser(t.db, { fullName: 'Pending', isApproved: false });
    const C = await createUser(t.db, { fullName: 'Chiku' });
    const D = await createUser(t.db, { fullName: 'Dalia' });
    for (const r of [B, C, D]) {
      await insertTx(t.db, { senderId: A.id, receiverId: r.id, amount: 1_500_000, createdAt: minutesAgo(NOON, 1) });
    }
    await insertTx(t.db, { senderId: C.id, receiverId: B.id, amount: 10, createdAt: minutesAgo(NOON, 1) });

    const res = await agent.get(`/api/me/send/context?receiverId=${B.id}`);
    expect(res.status).toBe(200);
    expect(res.body.recipients.map((r: { fullName: string }) => r.fullName)).toEqual(['Baraka Mushi', 'Chiku', 'Dalia']);
    expect(res.body.locations).toHaveLength(10);
    expect(res.body.defaultLocation).toBe('Arusha');
    expect(res.body.balance).toBe(1234.5);
    expect(res.body.largeVolume).toEqual({ count: 3, totalAmount: 4_500_000, blocked: false });
    expect(res.body.receivers).toEqual({ unique: 3, blocked: false });
    expect(res.body.senders).toEqual({ unique: 2, blocked: false });

    await insertTx(t.db, { senderId: A.id, receiverId: A.id, amount: 1, createdAt: minutesAgo(NOON, 1) });
    const four = await agent.get('/api/me/send/context');
    expect(four.body.receivers).toEqual({ unique: 4, blocked: true });
  });

  it('describes the withdraw form', async () => {
    const res = await agent.get('/api/me/withdraw/context');
    expect(res.body).toEqual({
      balance: 1234.5,
      locations: expect.any(Array),
      defaultLocation: 'Arusha',
      failedAttempts: 0,
      blocked: false,
    });
    for (let i = 0; i < 3; i++) {
      await agent.post('/api/me/withdrawals').send({ amount: 5_000_000, location: 'Arusha' });
    }
    const blocked = await agent.get('/api/me/withdraw/context');
    expect(blocked.body).toMatchObject({ failedAttempts: 3, blocked: true });
  });
});
