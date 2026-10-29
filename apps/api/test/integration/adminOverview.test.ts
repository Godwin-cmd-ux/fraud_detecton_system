import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { loginAs, makeTestApp } from '../helpers/app';
import type { TestApp } from '../helpers/app';
import { closeTestDb, truncateAll } from '../helpers/db';
import { createAdmin, createUser, insertTx } from '../helpers/fixtures';

// 12:00 UTC on 29 Oct = 15:00 Dar es Salaam.
const NOW = new Date('2026-10-29T12:00:00Z');
const daysAgo = (d: number, hourUtc = 12) => new Date(Date.UTC(2026, 9, 29 - d, hourUtc, 0, 0));

let t: TestApp;
let agent: supertest.Agent;

beforeEach(async () => {
  t = await makeTestApp({ now: NOW });
  await truncateAll(t.db);
  const admin = await createAdmin(t.db);
  agent = await loginAs(t, 'admin', admin.username, admin.password);
});
afterAll(closeTestDb);

describe('GET /api/admin/fraud-overview', () => {
  it('returns zeros and full zero-filled series on an empty database', async () => {
    const res = await agent.get('/api/admin/fraud-overview');
    expect(res.status).toBe(200);
    expect(res.body.stats).toEqual({
      total: 0, fraud: 0, legit: 0, pending: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0,
      avgScore: 0, maxScore: 0, minScore: 0, highPct: 0, mediumPct: 0, lowPct: 0,
    });
    expect(res.body.daily).toHaveLength(7);
    expect(res.body.daily[6].date).toBe('2026-10-29');
    expect(res.body.daily[0]).toEqual({ date: '2026-10-23', total: 0, fraud: 0, legit: 0 });
    expect(res.body.byHour).toHaveLength(24);
    expect(res.body.byType).toEqual([]);
    expect(res.body.topSuspects).toEqual([]);
  });

  it('buckets by day, type and hour, and ranks suspects', async () => {
    const A = await createUser(t.db, { fullName: 'Amina Hassan' });
    const B = await createUser(t.db, { fullName: 'Baraka Mushi' });
    const C = await createUser(t.db, { fullName: 'Chiku Ally' });
    // Today 15:00 Dar (hour 15): two FRAUD from A, one LEGIT from B.
    await insertTx(t.db, { senderId: A.id, receiverId: B.id, amount: 1000, fraudScore: 80, fraudPrediction: 'FRAUD', riskLevel: 'HIGH', createdAt: NOW });
    await insertTx(t.db, { senderId: A.id, receiverId: C.id, amount: 2000, fraudScore: 60, fraudPrediction: 'FRAUD', riskLevel: 'MEDIUM', createdAt: NOW });
    await insertTx(t.db, { senderId: B.id, receiverId: A.id, amount: 300, fraudScore: 10, fraudPrediction: 'LEGIT', riskLevel: 'LOW', createdAt: NOW });
    // Two days ago at 23:00 UTC = 02:00 Dar the next day (hour 2, date 2026-10-28): one FRAUD withdrawal from B.
    await insertTx(t.db, { senderId: B.id, transactionType: 'withdrawal', amount: 500, fraudScore: 90, fraudPrediction: 'FRAUD', riskLevel: 'HIGH', createdAt: daysAgo(2, 23) });
    // Ten days ago: outside the 7-day window, still counts in totals and by-type.
    await insertTx(t.db, { senderId: C.id, receiverId: A.id, amount: 50, fraudScore: 5, fraudPrediction: 'LEGIT', riskLevel: 'LOW', createdAt: daysAgo(10) });
    // Not yet analysed.
    await insertTx(t.db, { senderId: C.id, receiverId: A.id, amount: 60, createdAt: NOW });

    const res = await agent.get('/api/admin/fraud-overview');
    expect(res.body.stats).toMatchObject({
      total: 6, fraud: 3, legit: 2, pending: 1, highRisk: 2, mediumRisk: 1, lowRisk: 2,
      maxScore: 90, minScore: 0,
    });
    expect(res.body.stats.highPct).toBeCloseTo(33.3, 1);
    expect(res.body.stats.avgScore).toBeCloseTo(40.8, 1);

    const today = res.body.daily.find((d: { date: string }) => d.date === '2026-10-29');
    expect(today).toEqual({ date: '2026-10-29', total: 4, fraud: 2, legit: 1 });
    const twoDays = res.body.daily.find((d: { date: string }) => d.date === '2026-10-28');
    expect(twoDays).toEqual({ date: '2026-10-28', total: 1, fraud: 1, legit: 0 });

    expect(res.body.byType).toEqual(
      expect.arrayContaining([
        { type: 'transfer', total: 4, fraud: 2 },
        { type: 'withdrawal', total: 1, fraud: 1 },
      ]),
    );
    // Hour buckets have no date window: today's three plus the ten-day-old legit row (also 15:00 Dar).
    expect(res.body.byHour[15]).toEqual({ hour: 15, total: 4, fraud: 2 });
    expect(res.body.byHour[2]).toEqual({ hour: 2, total: 1, fraud: 1 });
    expect(res.body.byHour[0]).toEqual({ hour: 0, total: 0, fraud: 0 });

    expect(res.body.topSuspects).toEqual([
      { id: A.id, fullName: 'Amina Hassan', email: A.email, fraudCount: 2, totalAmount: 3000 },
      { id: B.id, fullName: 'Baraka Mushi', email: B.email, fraudCount: 1, totalAmount: 500 },
    ]);
  });
});
