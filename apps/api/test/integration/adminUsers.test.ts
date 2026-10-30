import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import type supertest from 'supertest';
import { seed } from '../../src/db/seed';
import { adminActions, transactions, users } from '../../src/db/schema';
import { loginAs, makeTestApp } from '../helpers/app';
import type { TestApp } from '../helpers/app';
import { closeTestDb, truncateAll } from '../helpers/db';
import { createAdmin, createUser, insertTx } from '../helpers/fixtures';

let t: TestApp;
let admin: Awaited<ReturnType<typeof createAdmin>>;
let agent: supertest.Agent;

beforeEach(async () => {
  t = await makeTestApp();
  await truncateAll(t.db);
  await seed(t.db);
  await t.db.execute(sql`delete from users`);
  await t.db.execute(sql`delete from admins`);
  admin = await createAdmin(t.db, { fullName: 'Root Admin' });
  agent = await loginAs(t, 'admin', admin.username, admin.password);
});
afterAll(closeTestDb);

const audits = async () => t.db.select().from(adminActions).orderBy(adminActions.id);

describe('access and listing', () => {
  it('rejects non-admins', async () => {
    const u = await createUser(t.db);
    const userAgent = await loginAs(t, 'user', u.email, u.password);
    expect((await userAgent.get('/api/admin/users')).status).toBe(401);
    expect((await t.agent().get('/api/admin/users')).status).toBe(401);
  });

  it('searches by name, email or phone and paginates 20 per page', async () => {
    for (let i = 0; i < 25; i++) await createUser(t.db, { fullName: `Person ${String(i).padStart(2, '0')}` });
    const target = await createUser(t.db, { fullName: 'Zuberi Omari', email: 'zuberi@find.me', phone: '+255799999999', cardNumber: '4111111111111111' });

    const page1 = await agent.get('/api/admin/users');
    expect(page1.body).toMatchObject({ page: 1, pageSize: 20, total: 26, totalPages: 2 });
    expect(page1.body.items).toHaveLength(20);
    expect(page1.body.items[0]).toMatchObject({ fullName: 'Zuberi Omari', cardLast4: '1111', status: 'active', balance: 1_000_000 });

    for (const q of ['zuberi', 'zuberi@find', '+2557999']) {
      const res = await agent.get(`/api/admin/users?search=${encodeURIComponent(q)}`);
      expect(res.body.total).toBe(1);
      expect(res.body.items[0].id).toBe(target.id);
    }
  });

  it('reports pending and inactive statuses and lists pending users', async () => {
    const pending = await createUser(t.db, { isApproved: false });
    const inactive = await createUser(t.db, { isActive: false });
    const one = await agent.get(`/api/admin/users/${pending.id}`);
    expect(one.body.status).toBe('pending');
    expect((await agent.get(`/api/admin/users/${inactive.id}`)).body.status).toBe('inactive');
    const list = await agent.get('/api/admin/pending-users');
    expect(list.body.map((u: { id: number }) => u.id)).toEqual([pending.id]);
    expect((await agent.get('/api/admin/users/999999')).status).toBe(404);
  });
});

describe('create user', () => {
  const body = {
    fullName: 'New Customer',
    email: 'new@test.local',
    phone: '+255 711 222 333',
    password: 'secret1',
    initialBalance: 25_000,
    cardNumber: '4242 4242 4242 4242',
    isApproved: true,
    answers: { mother_maiden: 'a', first_school: 'b', birth_city: 'c' },
  };

  it('creates an approved user and audits it', async () => {
    const res = await agent.post('/api/admin/users').send(body);
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('✅ User created successfully! Account is active.');
    const [u] = await t.db.select().from(users).where(eq(users.email, body.email));
    expect(u).toMatchObject({ isApproved: true, balance: '25000.00', phone: '+255711222333' });
    // The server issues the card now, so the submitted number is not stored.
    expect(u!.cardNumber).toMatch(/^44\d{14}$/);
    expect(u!.cardExpiry).toMatch(/^\d{2}\/\d{2}$/);
    expect(u!.cardCvc).toMatch(/^\d{3}$/);
    const [a] = await audits();
    expect(a).toMatchObject({
      actionType: 'create_user',
      adminId: admin.id,
      adminName: 'Root Admin',
      userId: u!.id,
      userName: 'New Customer',
      amount: '25000.00',
      reason: 'User created by admin',
      details: 'Security questions set: 3 answered',
    });
  });

  it('creates a pending user when not approved and refuses duplicates', async () => {
    const res = await agent.post('/api/admin/users').send({ ...body, isApproved: false });
    expect(res.body.message).toBe('✅ User created successfully! Account requires approval.');
    const dup = await agent.post('/api/admin/users').send(body);
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toBe('Email, phone number, or card number already exists');
  });
});

describe('user actions', () => {
  it('approves, disapproves, deactivates and activates with audit rows and no-op protection', async () => {
    const u = await createUser(t.db, { fullName: 'Pending Person', isApproved: false });

    const approve = await agent.post(`/api/admin/users/${u.id}/approve`).send({ reason: 'Docs verified' });
    expect(approve.status).toBe(200);
    expect(approve.body.message).toBe('✅ User approved successfully!');
    expect((await agent.post(`/api/admin/users/${u.id}/approve`).send({})).status).toBe(409);

    expect((await agent.post(`/api/admin/users/${u.id}/disapprove`).send({})).body.message).toBe('✅ User disapproved successfully!');
    expect((await agent.post(`/api/admin/users/${u.id}/deactivate`).send({})).body.message).toBe('✅ User deactivated successfully!');
    expect((await agent.post(`/api/admin/users/${u.id}/activate`).send({})).body.message).toBe('✅ User activated successfully!');

    const rows = await audits();
    expect(rows.map((r) => r.actionType)).toEqual(['approve_user', 'disapprove_user', 'deactivate_user', 'activate_user']);
    expect(rows[0]).toMatchObject({ reason: 'Docs verified', details: 'User account approved', userName: 'Pending Person' });
    expect(rows[1]).toMatchObject({ reason: 'User account disapproved', details: 'User disapproved by admin' });
    expect(rows[2]).toMatchObject({ reason: 'User account deactivated', details: 'User deactivated by admin' });
    expect(rows[3]).toMatchObject({ reason: 'User account activated', details: 'User activated by admin' });
  });

  it('rejects only pending users (hard delete) and requires a reason', async () => {
    const approved = await createUser(t.db);
    expect((await agent.post(`/api/admin/users/${approved.id}/reject`).send({ reason: 'x' })).status).toBe(409);

    const pending = await createUser(t.db, { isApproved: false });
    expect((await agent.post(`/api/admin/users/${pending.id}/reject`).send({})).status).toBe(400);
    const res = await agent.post(`/api/admin/users/${pending.id}/reject`).send({ reason: 'Fake documents' });
    expect(res.body.message).toBe('✅ User rejected and removed.');
    expect(await t.db.select().from(users).where(eq(users.id, pending.id))).toHaveLength(0);
    const [a] = await audits();
    expect(a).toMatchObject({ actionType: 'reject_user', reason: 'Fake documents', details: 'User account rejected' });
  });

  it('delete keeps transaction history', async () => {
    const u = await createUser(t.db, { fullName: 'Gone Soon', email: 'gone@test.local' });
    const other = await createUser(t.db);
    await insertTx(t.db, { senderId: u.id, receiverId: other.id, senderName: 'Gone Soon', amount: 10 });
    await insertTx(t.db, { senderId: other.id, receiverId: u.id, receiverName: 'Gone Soon', amount: 20 });

    const res = await agent.delete(`/api/admin/users/${u.id}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('🗑️ User deleted successfully!');
    const rows = await t.db.select().from(transactions).orderBy(transactions.id);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.senderId).toBeNull();
    expect(rows[0]!.senderName).toBe('Gone Soon');
    expect(rows[1]!.receiverId).toBeNull();
    const [a] = await audits();
    expect(a).toMatchObject({ actionType: 'delete_user', userName: 'Gone Soon', details: 'User deleted by admin - Email: gone@test.local' });
    expect((await agent.delete(`/api/admin/users/${u.id}`)).status).toBe(404);
  });
});

describe('balance adjustments', () => {
  it('credits the balance, records a transaction with the admin, and audits', async () => {
    const u = await createUser(t.db, { fullName: 'Neema Joseph', balance: 1000 });
    const res = await agent.post(`/api/admin/users/${u.id}/balance`).send({ amount: 250_000, type: 'bonus', reason: 'Loyalty bonus for October' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ newBalance: 251_000, message: "✅ Successfully added TSh 250,000.00 to Neema Joseph's account!" });
    const [tx] = await t.db.select().from(transactions);
    expect(tx).toMatchObject({
      transactionType: 'bonus',
      status: 'SUCCESS',
      senderId: null,
      receiverId: u.id,
      receiverName: 'Neema Joseph',
      adminId: admin.id,
      fraudScore: '0.00',
      message: 'Admin adjustment: Loyalty bonus for October',
    });
    const [a] = await audits();
    expect(a).toMatchObject({ actionType: 'add_balance', amount: '250000.00', reason: 'Loyalty bonus for October', userId: u.id });

    const list = await agent.get(`/api/admin/users/${u.id}/adjustments`);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ amount: 250_000, type: 'bonus', reason: 'Admin adjustment: Loyalty bonus for October' });
  });

  it('enforces the maximum and the reason length', async () => {
    const u = await createUser(t.db);
    expect((await agent.post(`/api/admin/users/${u.id}/balance`).send({ amount: 10_000_000.01, type: 'deposit', reason: 'long enough reason' })).status).toBe(400);
    expect((await agent.post(`/api/admin/users/${u.id}/balance`).send({ amount: 100, type: 'deposit', reason: 'short' })).status).toBe(400);
    expect((await agent.post(`/api/admin/users/999999/balance`).send({ amount: 100, type: 'deposit', reason: 'long enough reason' })).status).toBe(404);
  });
});
