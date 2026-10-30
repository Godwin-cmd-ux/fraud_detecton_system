import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { seed } from '../../src/db/seed';
import { makeTestApp } from '../helpers/app';
import type { TestApp } from '../helpers/app';
import { closeTestDb, truncateAll } from '../helpers/db';
import { createAdmin } from '../helpers/fixtures';

let t: TestApp;

beforeAll(async () => {
  t = await makeTestApp();
});
afterAll(closeTestDb);
beforeEach(async () => {
  await truncateAll(t.db);
  await t.db.execute(sql`delete from users`);
  await seed(t.db);
  await t.db.execute(sql`delete from users`);
  await t.db.execute(sql`delete from admins`);
});

const body = {
  fullName: 'Zawadi Peter',
  email: 'zawadi@test.local',
  phone: '+255 745 000 111',
  password: 'secret1',
  confirmPassword: 'secret1',
  cardNumber: '5555 4444 3333 1111',
  answers: { mother_maiden: 'Mama', first_school: 'Mlimani', birth_city: 'Dodoma', first_pet: '' },
};

describe('POST /api/auth/register', () => {
  it('creates a pending user with hashed security answers', async () => {
    const res = await t.agent().post('/api/auth/register').send(body);
    expect(res.status).toBe(201);
    expect(res.body.message).toBe(
      "Registration successful. Your account is pending admin approval — you'll be notified once it's reviewed.",
    );
    const rows = await t.db.execute(
      sql`select is_approved, balance, phone, card_number, security_answers from users where email = 'zawadi@test.local'`,
    );
    const u = rows.rows[0] as {
      is_approved: boolean;
      balance: string;
      phone: string;
      card_number: string;
      security_answers: Record<string, string>;
    };
    expect(u.is_approved).toBe(false);
    expect(u.balance).toBe('0.00');
    expect(u.phone).toBe('+255745000111');
    // The server issues the card: 16 digits, prefix 44, and the client's number is not used.
    expect(u.card_number).toMatch(/^44\d{14}$/);
    expect(u.card_number).not.toBe('5555444433331111');
    expect(Object.keys(u.security_answers).sort()).toEqual(['birth_city', 'first_school', 'mother_maiden']);
    expect(u.security_answers.mother_maiden).not.toBe('Mama');
    expect(await bcrypt.compare('Mama', u.security_answers.mother_maiden!)).toBe(true);
  });

  it('refuses duplicates', async () => {
    await t.agent().post('/api/auth/register').send(body);
    const res = await t.agent().post('/api/auth/register').send({ ...body, phone: '+255745000222', cardNumber: '5555444433332222' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Email, phone number, or card number already exists');
  });

  it('blocks login until approved', async () => {
    await t.agent().post('/api/auth/register').send(body);
    const res = await t.agent().post('/api/auth/login').send({ role: 'user', login: body.email, password: body.password });
    expect(res.status).toBe(403);
  });

  it('rejects answers that do not match active questions', async () => {
    const res = await t.agent().post('/api/auth/register').send({ ...body, answers: { a: '1', b: '2', c: '3' } });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/admin-signup', () => {
  const admin = {
    fullName: 'Root Admin',
    username: 'root_admin',
    email: 'root@test.local',
    password: 'Password1!',
    confirmPassword: 'Password1!',
  };

  it('lets the first admin sign up without a key, then requires it', async () => {
    const status = await t.agent().get('/api/auth/admin-signup/status');
    expect(status.body).toEqual({ firstAdmin: true });

    const first = await t.agent().post('/api/auth/admin-signup').send(admin);
    expect(first.status).toBe(201);

    const noKey = await t.agent().post('/api/auth/admin-signup').send({ ...admin, username: 'second', email: 'second@test.local' });
    expect(noKey.status).toBe(403);
    expect(noKey.body.error.message).toBe("❌ Invalid secret key. You don't have permission to create admin accounts.");

    const withKey = await t.agent().post('/api/auth/admin-signup').send({ ...admin, username: 'second', email: 'second@test.local', secretKey: 'AdminSetupTZ' });
    expect(withKey.status).toBe(201);

    const dup = await t.agent().post('/api/auth/admin-signup').send({ ...admin, email: 'third@test.local', secretKey: 'AdminSetupTZ' });
    expect(dup.status).toBe(409);
    expect((await t.agent().get('/api/auth/admin-signup/status')).body).toEqual({ firstAdmin: false });
  });

  it('created admins can log in', async () => {
    await createAdmin(t.db, { username: 'existing' });
    const res = await t.agent().post('/api/auth/admin-signup').send({ ...admin, secretKey: 'AdminSetupTZ' });
    expect(res.status).toBe(201);
    const login = await t.agent().post('/api/auth/login').send({ role: 'admin', login: admin.username, password: admin.password });
    expect(login.status).toBe(200);
  });
});

describe('GET /api/security-questions', () => {
  it('lists active questions with key and text', async () => {
    const res = await t.agent().get('/api/security-questions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
    expect(res.body[0]).toMatchObject({ id: expect.any(Number), key: expect.any(String), text: expect.any(String) });
  });
});
