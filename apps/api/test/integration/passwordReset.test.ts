import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { seed } from '../../src/db/seed';
import { makeTestApp } from '../helpers/app';
import type { TestApp } from '../helpers/app';
import { closeTestDb, truncateAll } from '../helpers/db';
import { createUser } from '../helpers/fixtures';

let t: TestApp;
const start = new Date('2026-10-29T12:00:00Z');

beforeAll(async () => {
  t = await makeTestApp({ now: start });
});
afterAll(closeTestDb);
beforeEach(async () => {
  await truncateAll(t.db);
  await seed(t.db);
  await t.db.execute(sql`delete from users`);
  t.clock.now = start;
});

async function userWithAnswers(over: Parameters<typeof createUser>[1] = {}) {
  const h = await bcrypt.hash('answer', 4);
  return createUser(t.db, {
    securityAnswers: { mother_maiden: h, first_school: h, birth_city: h },
    ...over,
  });
}

describe('forgot-password/start', () => {
  it('rejects unknown, deactivated, pending and under-configured accounts in that order', async () => {
    const unknown = await t.agent().post('/api/auth/forgot-password/start').send({ email: 'x@test.local' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.message).toBe('Email not found. Please check your email address.');

    const inactive = await userWithAnswers({ isActive: false });
    const r1 = await t.agent().post('/api/auth/forgot-password/start').send({ email: inactive.email });
    expect(r1.status).toBe(403);
    expect(r1.body.error.code).toBe('DEACTIVATED');

    const pending = await userWithAnswers({ isApproved: false });
    const r2 = await t.agent().post('/api/auth/forgot-password/start').send({ email: pending.email });
    expect(r2.status).toBe(403);
    expect(r2.body.error.code).toBe('PENDING_APPROVAL');

    const h = await bcrypt.hash('a', 4);
    const few = await createUser(t.db, { securityAnswers: { mother_maiden: h, first_school: h } });
    const r3 = await t.agent().post('/api/auth/forgot-password/start').send({ email: few.email });
    expect(r3.status).toBe(400);
    expect(r3.body.error.code).toBe('INSUFFICIENT_QUESTIONS');
  });

  it('returns the answered questions', async () => {
    const u = await userWithAnswers();
    const res = await t.agent().post('/api/auth/forgot-password/start').send({ email: u.email });
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(3);
    expect(res.body.questions[0]).toMatchObject({ key: expect.any(String), text: expect.any(String) });
  });
});

describe('forgot-password/verify', () => {
  it('requires the start step in the session', async () => {
    const res = await t.agent().post('/api/auth/forgot-password/verify').send({ answers: { a: 'b' } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('counts correct answers and issues a 5-minute token on 3 correct', async () => {
    const u = await userWithAnswers();
    const a = t.agent();
    await a.post('/api/auth/forgot-password/start').send({ email: u.email });

    const partial = await a.post('/api/auth/forgot-password/verify').send({
      answers: { mother_maiden: 'answer', first_school: 'answer', birth_city: 'wrong' },
    });
    expect(partial.status).toBe(400);
    expect(partial.body.error.message).toBe('Incorrect answers. Please try again. (2/3 correct)');

    const ok = await a.post('/api/auth/forgot-password/verify').send({
      answers: { mother_maiden: 'answer', first_school: 'answer', birth_city: 'answer' },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(ok.body.expiresAt).getTime()).toBe(start.getTime() + 5 * 60_000);
    const row = await t.db.execute(sql`select reset_token from users where id = ${u.id}`);
    expect(row.rows[0]).toEqual({ reset_token: ok.body.token });
  });

  it('locks after three wrong attempts', async () => {
    const u = await userWithAnswers();
    const a = t.agent();
    await a.post('/api/auth/forgot-password/start').send({ email: u.email });
    const wrong = { answers: { mother_maiden: 'x', first_school: 'x', birth_city: 'x' } };
    await a.post('/api/auth/forgot-password/verify').send(wrong);
    await a.post('/api/auth/forgot-password/verify').send(wrong);
    const third = await a.post('/api/auth/forgot-password/verify').send(wrong);
    expect(third.status).toBe(423);
  });
});

describe('reset-password', () => {
  async function tokenFor(u: { email: string }) {
    const a = t.agent();
    await a.post('/api/auth/forgot-password/start').send({ email: u.email });
    const ok = await a.post('/api/auth/forgot-password/verify').send({
      answers: { mother_maiden: 'answer', first_school: 'answer', birth_city: 'answer' },
    });
    return ok.body.token as string;
  }

  it('validates the token, expires it after 5 minutes', async () => {
    const u = await userWithAnswers();
    const token = await tokenFor(u);
    const valid = await t.agent().get(`/api/auth/reset-password/${token}`);
    expect(valid.body).toMatchObject({ valid: true, userName: u.fullName });
    t.clock.now = new Date(start.getTime() + 6 * 60_000);
    const expired = await t.agent().get(`/api/auth/reset-password/${token}`);
    expect(expired.body).toEqual({ valid: false, reason: 'EXPIRED' });
    const reset = await t.agent().post('/api/auth/reset-password').send({ token, password: 'newpass1', confirmPassword: 'newpass1' });
    expect(reset.status).toBe(400);
    expect(reset.body.error.code).toBe('EXPIRED_TOKEN');
  });

  it('sets the new password once and clears the token', async () => {
    const u = await userWithAnswers();
    const token = await tokenFor(u);
    const reset = await t.agent().post('/api/auth/reset-password').send({ token, password: 'newpass1', confirmPassword: 'newpass1' });
    expect(reset.status).toBe(200);
    expect(reset.body.message).toBe('Password reset successfully. You can now sign in with your new password.');

    const old = await t.agent().post('/api/auth/login').send({ role: 'user', login: u.email, password: u.password });
    expect(old.status).toBe(401);
    const fresh = await t.agent().post('/api/auth/login').send({ role: 'user', login: u.email, password: 'newpass1' });
    expect(fresh.status).toBe(200);

    const again = await t.agent().post('/api/auth/reset-password').send({ token, password: 'other12', confirmPassword: 'other12' });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('INVALID_TOKEN');
    expect((await t.agent().get(`/api/auth/reset-password/${token}`)).body).toEqual({ valid: false, reason: 'INVALID' });
  });
});
