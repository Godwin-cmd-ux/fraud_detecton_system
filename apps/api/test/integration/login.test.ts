import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { makeTestApp } from '../helpers/app';
import type { TestApp } from '../helpers/app';
import { closeTestDb, truncateAll } from '../helpers/db';
import { createAdmin, createUser } from '../helpers/fixtures';

let t: TestApp;
const start = new Date('2026-10-29T12:00:00Z');

beforeAll(async () => {
  t = await makeTestApp({ now: start });
});
afterAll(closeTestDb);
beforeEach(async () => {
  await truncateAll(t.db);
  t.clock.now = start;
});

const login = (role: 'user' | 'admin', login: string, password: string) =>
  t.agent().post('/api/auth/login').send({ role, login, password });

describe('user login', () => {
  it('accepts email, phone or card number and exposes the principal', async () => {
    const u = await createUser(t.db, { fullName: 'Amina Hassan' });
    for (const id of [u.email, u.phone, u.cardNumber]) {
      const a = t.agent();
      const res = await a.post('/api/auth/login').send({ role: 'user', login: id, password: u.password });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ kind: 'user', id: u.id, name: 'Amina Hassan', email: u.email });
      const me = await a.get('/api/auth/me');
      expect(me.status).toBe(200);
      expect(me.body.kind).toBe('user');
    }
  });

  it('counts down attempts, locks on the third failure, and refuses until the lock expires', async () => {
    const u = await createUser(t.db);
    const first = await login('user', u.email, 'wrong');
    expect(first.status).toBe(401);
    expect(first.body.error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid user credentials. 2 attempt(s) remaining before lockout.',
      fields: { attemptsRemaining: '2' },
    });
    const second = await login('user', u.email, 'wrong');
    expect(second.body.error.fields.attemptsRemaining).toBe('1');

    const third = await login('user', u.email, 'wrong');
    expect(third.status).toBe(423);
    expect(third.body.error.message).toBe('Too many failed attempts. Account locked for 5 minute(s).');

    const locked = await login('user', u.email, u.password);
    expect(locked.status).toBe(423);
    expect(locked.body.error.message).toMatch(/^Your account is locked\. Please wait \d minute\(s\) before trying again\.$/);
    expect(locked.body.error.fields).toHaveProperty('minutesRemaining');

    const logged = await t.db.execute(sql`select count(*)::int as c from failed_login_log`);
    expect(logged.rows[0]).toEqual({ c: 3 });
  });

  it('releases the lock after 5 minutes and restarts the counter', async () => {
    const u = await createUser(t.db);
    for (let i = 0; i < 3; i++) await login('user', u.email, 'wrong');

    t.clock.now = new Date(start.getTime() + 6 * 60_000);
    const ok = await login('user', u.email, u.password);
    expect(ok.status).toBe(200);
    const attempts = await t.db.execute(sql`select attempt_count from login_attempts`);
    expect(attempts.rows[0]).toEqual({ attempt_count: 0 });

    for (let i = 0; i < 3; i++) await login('user', u.email, 'wrong');
    t.clock.now = new Date(start.getTime() + 12 * 60_000);
    const afterExpiry = await login('user', u.email, 'wrong');
    expect(afterExpiry.status).toBe(401);
    expect(afterExpiry.body.error.fields.attemptsRemaining).toBe('2');
  });

  it('refuses unapproved users without counting a failure', async () => {
    const u = await createUser(t.db, { isApproved: false });
    const res = await login('user', u.email, u.password);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({
      code: 'PENDING_APPROVAL',
      message: 'Your account is pending admin approval. Please wait for confirmation.',
    });
    const logged = await t.db.execute(sql`select count(*)::int as c from failed_login_log`);
    expect(logged.rows[0]).toEqual({ c: 0 });
  });

  it('treats an unknown login like a wrong password', async () => {
    const res = await login('user', 'nobody@test.local', 'x');
    expect(res.status).toBe(401);
    expect(res.body.error.fields.attemptsRemaining).toBe('2');
  });
});

describe('admin login', () => {
  it('accepts username or email and records last_login', async () => {
    const a = await createAdmin(t.db);
    for (const id of [a.username, a.email]) {
      const res = await login('admin', id, a.password);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ kind: 'admin', id: a.id, name: a.fullName });
    }
    const row = await t.db.execute(sql`select last_login from admins where id = ${a.id}`);
    expect((row.rows[0] as { last_login: unknown }).last_login).not.toBeNull();
  });

  it('uses the admin wording on failure', async () => {
    const a = await createAdmin(t.db);
    const res = await login('admin', a.username, 'nope');
    expect(res.body.error.message).toBe('Invalid admin credentials. 2 attempt(s) remaining before lockout.');
  });
});

describe('session lifecycle', () => {
  it('logs out and replaces the session when another principal logs in', async () => {
    const u = await createUser(t.db);
    const ad = await createAdmin(t.db);
    const agent = t.agent();
    await agent.post('/api/auth/login').send({ role: 'user', login: u.email, password: u.password });
    const out = await agent.post('/api/auth/logout').send({});
    expect(out.status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);

    await agent.post('/api/auth/login').send({ role: 'user', login: u.email, password: u.password });
    await agent.post('/api/auth/login').send({ role: 'admin', login: ad.username, password: ad.password });
    const me = await agent.get('/api/auth/me');
    expect(me.body.kind).toBe('admin');
  });
});
