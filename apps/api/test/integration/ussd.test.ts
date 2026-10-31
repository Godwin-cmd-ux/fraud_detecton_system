import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { env } from '../../src/config/env';
import { adminActions, admins, transactions, users, ussdRequests, ussdSessions } from '../../src/db/schema';
import { loginAs, makeTestApp } from '../helpers/app';
import type { TestApp } from '../helpers/app';
import { closeTestDb, truncateAll } from '../helpers/db';
import { createAdmin, createUser } from '../helpers/fixtures';
import type { SendSmsInput } from '../../src/modules/sms/client';
import * as ussdRepo from '../../src/ussd/repo';

const TOKEN = env.USSD_CALLBACK_SECRET;
const NOON = new Date('2026-10-29T12:00:00Z');
const SERVICE = '*150*00#';

let t: TestApp;

/** Unique gateway session id per test. */
const sessionId = () => `us-${Math.random().toString(36).slice(2)}${Date.now()}`;

/** A valid Tanzanian number, distinct per index. */
const phoneFor = (n: number) => `+2557${70_000_000 + n}`;

async function post(session: string, phone: string, text: string) {
  return t
    .agent()
    .post(`/api/ussd/callback?token=${encodeURIComponent(TOKEN)}`)
    .type('form')
    .send({ sessionId: session, serviceCode: SERVICE, phoneNumber: phone, text });
}

/**
 * Plays a session the way the gateway does: each step appends one segment to the cumulative
 * `text` field, which is what lets the service verify continuity and deduplicate retries.
 */
function flow(session: string, phone: string) {
  let text = '';
  return async (input?: string) => {
    if (input !== undefined) text = text ? `${text}*${input}` : input;
    const res = await post(session, phone, text);
    return { text: res.text as string, status: res.status };
  };
}

const balanceOf = async (id: number) => {
  const [row] = await t.db.select({ balance: users.balance }).from(users).where(eq(users.id, id));
  return Number(row!.balance);
};

beforeEach(async () => {
  t = await makeTestApp({ now: NOON });
  await truncateAll(t.db);
});

afterAll(closeTestDb);
afterEach(() => vi.restoreAllMocks());

describe('USSD callback endpoint', () => {
  it('rejects a callback that does not carry the shared secret', async () => {
    const res = await t.agent().post('/api/ussd/callback').type('form').send({
      sessionId: 'x',
      phoneNumber: phoneFor(1),
      text: '',
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('offers registration to a number that has no account', async () => {
    const f = flow(sessionId(), phoneFor(2));
    const res = await f();
    expect(res.text.startsWith('CON ')).toBe(true);
    expect(res.text).toContain('1. Register');
  });

  it('registers a new customer and leaves the account awaiting approval', async () => {
    const phone = phoneFor(3);
    const f = flow(sessionId(), phone);
    await f();
    await f('1');
    await f('Zawadi Mwinyi');
    await f('zawadi.ussd@test.local');
    // No card screen: the server issues the card.
    await f('1234');
    await f('1234');
    const review = await f();
    expect(review.text).toContain('CONFIRM DETAILS');

    const submitted = await f('1');
    expect(submitted.text).toContain('REGISTRATION SUBMITTED');

    const [created] = await t.db.select().from(users).where(eq(users.email, 'zawadi.ussd@test.local'));
    expect(created).toBeTruthy();
    expect(created!.phone).toBe(phone);
    expect(created!.isApproved).toBe(false);
    expect(created!.transactionPinHash).toBeTruthy();

    // The next dial explains the pending state instead of opening the dashboard.
    const again = flow(sessionId(), phone);
    expect((await again()).text).toContain('Awaiting admin approval');
  });
});

describe('customer dashboard', () => {
  it('shows the balance that is stored in the shared database', async () => {
    const user = await createUser(t.db, { phone: phoneFor(4), balance: 1_250_000 });
    const f = flow(sessionId(), user.phone);
    expect((await f()).text).toContain('Welcome');

    const balance = await f('5');
    expect(balance.text).toContain('TSh 1,250,000');
  });

  it('sends money through the same ledger, enrolling a PIN first', async () => {
    const sender = await createUser(t.db, { phone: phoneFor(5), fullName: 'Amina Hassan', balance: 1_000_000 });
    const receiver = await createUser(t.db, { phone: phoneFor(6), fullName: 'Baraka Mushi', balance: 0 });

    const f = flow(sessionId(), sender.phone);
    await f();
    await f('2');
    const to = await f(receiver.phone);
    expect(to.text).toContain('Baraka Mushi');

    const amount = await f('50000');
    expect(amount.text).toContain('PIN required');

    await f('1');
    expect((await f('4321')).text).toContain('Confirm');
    expect((await f('4321')).text).toContain('PIN set');

    const done = await f('4321');
    expect(done.text.startsWith('END ')).toBe(true);
    expect(done.text).toContain('Sent TSh 50,000');
    expect(done.text).toContain('TXN');

    // 1,000,000 - 50,000 - 0.8% fee (400.00).
    expect(await balanceOf(sender.id)).toBe(949_600);
    expect(await balanceOf(receiver.id)).toBe(50_000);

    const [tx] = await t.db.select().from(transactions).where(eq(transactions.senderId, sender.id));
    expect(tx!.status).toBe('SUCCESS');
    expect(tx!.message).toBe('USSD transfer');
    expect(tx!.ipAddress).toBeTruthy();
  });

  it('refuses an amount above the available balance without moving money', async () => {
    const sender = await createUser(t.db, { phone: phoneFor(7), balance: 10_000 });
    const receiver = await createUser(t.db, { phone: phoneFor(8), balance: 0 });

    const f = flow(sessionId(), sender.phone);
    await f();
    await f('2');
    await f(receiver.phone);
    const tooMuch = await f('999999');
    expect(tooMuch.text).toContain('Insufficient balance');

    expect(await balanceOf(sender.id)).toBe(10_000);
    expect(await balanceOf(receiver.id)).toBe(0);
  });

  it('locks the PIN after three wrong attempts', async () => {
    const user = await createUser(t.db, { phone: phoneFor(9), balance: 500_000 });
    const receiver = await createUser(t.db, { phone: phoneFor(10), balance: 0 });
    await t.db
      .update(users)
      .set({ transactionPinHash: await bcrypt.hash('1111', 4) })
      .where(eq(users.id, user.id));

    const f = flow(sessionId(), user.phone);
    await f();
    await f('2');
    await f(receiver.phone);
    await f('1000');

    const first = await f('0000');
    expect(first.text).toContain('2 attempt(s) left');
    await f('0000');
    const third = await f('0000');
    expect(third.text.startsWith('END ')).toBe(true);
    expect(third.text).toContain('Locked');

    const [row] = await t.db.select().from(users).where(eq(users.id, user.id));
    expect(row!.pinLockedUntil).toBeTruthy();
    expect(await balanceOf(user.id)).toBe(500_000);
  });
});

describe('administrator dashboard', () => {
  async function adminFlow(n: number) {
    const admin = await createAdmin(t.db, { phone: phoneFor(n), fullName: 'System Administrator' });
    return { admin, f: flow(sessionId(), admin.phone!) };
  }

  it('opens a different dashboard for an administrator number', async () => {
    const { f } = await adminFlow(11);
    const menu = await f();
    expect(menu.text).toContain('ADMIN');
    expect(menu.text).not.toContain('Send Money');
    expect(menu.text).toContain('3. Approvals');
  });

  it('approves a pending registration so it appears approved in the database', async () => {
    const { f } = await adminFlow(12);
    const pending = await createUser(t.db, { phone: phoneFor(13), isApproved: false });

    await f();
    await f('3');
    const view = await f('1');
    expect(view.text).toContain('Approve');

    const done = await f('1');
    expect(done.text).toContain('approved');

    const [row] = await t.db.select().from(users).where(eq(users.id, pending.id));
    expect(row!.isApproved).toBe(true);
  });

  it('creates a user with an opening balance and audits the action', async () => {
    const { f } = await adminFlow(14);
    await f();
    await f('4');
    await f('Neema Joseph');
    await f('neema.ussd@test.local');
    await f(phoneFor(15));
    // No card screen: the server issues the card.
    await f('10000');
    await f('1'); // approve immediately
    await f('1'); // set admin PIN
    await f('2468');
    await f('2468');
    const done = await f('2468');

    expect(done.text.startsWith('END ')).toBe(true);
    expect(done.text).toContain('User created');

    const [created] = await t.db.select().from(users).where(eq(users.email, 'neema.ussd@test.local'));
    expect(created).toBeTruthy();
    expect(created!.isApproved).toBe(true);
    expect(Number(created!.balance)).toBe(10_000);

    const [action] = await t.db.select().from(adminActions).where(eq(adminActions.actionType, 'create_user'));
    expect(action).toBeTruthy();
    expect(action!.details).toContain('USSD');
  });

  it('adds balance through the shared adjustment service', async () => {
    const { f } = await adminFlow(16);
    const target = await createUser(t.db, { phone: phoneFor(17), balance: 0 });

    await f();
    await f('6');
    await f('1');
    await f(target.phone);
    await f('1'); // deposit
    await f('2500');
    const confirm = await f('correction from admin');
    expect(confirm.text).toContain('Confirm');

    await f('1');
    await f('1'); // set admin PIN
    await f('9876');
    await f('9876');
    const done = await f('9876');

    expect(done.text.startsWith('END ')).toBe(true);
    expect(await balanceOf(target.id)).toBe(2_500);

    const [action] = await t.db.select().from(adminActions).where(eq(adminActions.actionType, 'add_balance'));
    expect(action).toBeTruthy();
    expect(action!.amount).toBe('2500.00');
    expect(action!.reason).toBe('correction from admin');
  });
});

describe('security', () => {
  it('returns the recorded response instead of executing a repeated callback twice', async () => {
    const sender = await createUser(t.db, { phone: phoneFor(18), balance: 1_000_000 });
    const receiver = await createUser(t.db, { phone: phoneFor(19), balance: 0 });
    await t.db
      .update(users)
      .set({ transactionPinHash: await bcrypt.hash('1111', 4) })
      .where(eq(users.id, sender.id));

    const session = sessionId();
    const f = flow(session, sender.phone);
    await f();
    await f('2');
    await f(receiver.phone);
    await f('25000');
    const done = await f('1111');
    expect(done.text).toContain('Sent TSh 25,000');

    // The gateway may retry the final callback; it must not credit the receiver twice.
    const replay = await post(session, sender.phone, `2*${receiver.phone}*25000*1111`);
    expect(replay.text).toBe(done.text);
    // 1,000,000 - 25,000 - 0.8% fee (200.00).
    expect(await balanceOf(sender.id)).toBe(974_800);
    expect(await balanceOf(receiver.id)).toBe(25_000);
  });

  it('ends the session when the input does not extend the previous text', async () => {
    const user = await createUser(t.db, { phone: phoneFor(20) });
    const session = sessionId();
    await post(session, user.phone, '');
    await post(session, user.phone, '1');

    const forged = await post(session, user.phone, '2');
    expect(forged.text).toContain('Session error');
  });

  it('refuses to run an administrator screen for a customer session', async () => {
    const user = await createUser(t.db, { phone: phoneFor(21) });
    const session = sessionId();
    await post(session, user.phone, '');

    // Simulate a tampered session: point the stored state at an admin-only screen.
    await t.db
      .update(ussdSessions)
      .set({ state: { scene: 'admin.overview', stack: [], data: {} } })
      .where(eq(ussdSessions.id, session));

    const res = await post(session, user.phone, '1');
    expect(res.text).toContain('END ');
    expect(res.text).toContain('Not authorised');
  });

  it('does not keep a PIN in the request ledger', async () => {
    const user = await createUser(t.db, { phone: phoneFor(22), balance: 500_000 });
    await t.db
      .update(users)
      .set({ transactionPinHash: await bcrypt.hash('1357', 4) })
      .where(eq(users.id, user.id));
    const receiver = await createUser(t.db, { phone: phoneFor(23), balance: 0 });

    const f = flow(sessionId(), user.phone);
    await f();
    await f('2');
    await f(receiver.phone);
    await f('1000');
    await f('1357');

    const rows = await t.db.select().from(transactions);
    expect(rows.length).toBe(1);

    const logged = await t.db.select().from(ussdRequests);
    expect(logged.length).toBeGreaterThan(0);
    for (const row of logged) expect(row.text).not.toContain('1357');
  });
});

describe('integration with the web application', () => {
  it('shows a USSD transaction in the admin transaction API', async () => {
    const sender = await createUser(t.db, { phone: phoneFor(24), fullName: 'Amina Hassan', balance: 400_000 });
    const receiver = await createUser(t.db, { phone: phoneFor(25), fullName: 'Juma Mwangi', balance: 0 });
    await t.db
      .update(users)
      .set({ transactionPinHash: await bcrypt.hash('1111', 4) })
      .where(eq(users.id, sender.id));

    const f = flow(sessionId(), sender.phone);
    await f();
    await f('2');
    await f(receiver.phone);
    await f('40000');
    const done = await f('1111');
    expect(done.text).toContain('Sent TSh 40,000');

    const admin = await createAdmin(t.db, { username: 'webadmin', email: 'webadmin@test.local' });
    const agent = await loginAs(t, 'admin', admin.username, admin.password);
    const res = await agent.get('/api/admin/transactions').query({ search: receiver.fullName });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].amount).toBe(40_000);
    expect(res.body.items[0].status).toBe('SUCCESS');
  });

  it('lets a customer registered on the web use the USSD dashboard', async () => {
    const user = await createUser(t.db, { phone: phoneFor(26), fullName: 'Neema Joseph', balance: 750_000 });
    const f = flow(sessionId(), user.phone);
    const menu = await f();
    expect(menu.text).toContain('Neema');
    expect((await f('1')).text).toContain('Neema Joseph');
  });
});

describe('SMS for USSD interactions', () => {
  const send = vi.fn(async (_input: SendSmsInput) => null);

  beforeEach(async () => {
    send.mockReset();
    send.mockResolvedValue(null);
    t = await makeTestApp({ now: NOON, sms: { send } });
  });

  it('texts welcome, navigation, balance and exit screens once per new callback', async () => {
    const user = await createUser(t.db, { phone: phoneFor(30), balance: 1_250_000 });
    const session = sessionId();
    const f = flow(session, user.phone);
    await f();
    await f('5');
    await f('0');
    await f('0');

    expect(send).toHaveBeenCalledTimes(4);
    expect(send.mock.calls[1]![0]).toEqual({
      to: user.phone,
      message: 'USSD\nAVAILABLE BALANCE\nTSh 1,250,000\nCurrency TZS\n0. Back',
    });
    expect(send.mock.calls[3]![0].message).toContain('Thank you');

    await post(session, user.phone, '5*0*0');
    expect(send).toHaveBeenCalledTimes(4);
  });

  it('texts registration progress and submission without copying PIN inputs', async () => {
    const phone = phoneFor(31);
    const f = flow(sessionId(), phone);
    for (const input of [undefined, '1', 'SMS Test Customer', 'sms.ussd@test.local', '6842', '6842', '1']) {
      await f(input);
    }

    expect(send).toHaveBeenCalledTimes(7);
    expect(send.mock.calls.at(-1)![0].message).toContain('REGISTRATION SUBMITTED');
    for (const [notice] of send.mock.calls) {
      expect(notice.to).toBe(phone);
      expect(notice.message).not.toContain('6842');
    }
  });

  it('texts PIN creation, validation errors and lockout without revealing the PIN', async () => {
    const sender = await createUser(t.db, { phone: phoneFor(32), balance: 100_000 });
    const receiver = await createUser(t.db, { phone: phoneFor(33), balance: 0 });
    const f = flow(sessionId(), sender.phone);
    for (const input of [undefined, '2', receiver.phone, '1000', '1', '6842', '6842']) {
      await f(input);
    }
    expect(send.mock.calls.at(-1)![0].message).toContain('PIN set');
    for (const input of ['9461', '9461', '9461']) await f(input);
    expect(send.mock.calls.at(-1)![0].message).toContain('Locked for 15 min');
    expect(send.mock.calls.some(([n]) => n.message.includes('2 attempt(s) left'))).toBe(true);
    for (const [notice] of send.mock.calls) {
      expect(notice.message).not.toContain('6842');
      expect(notice.message).not.toContain('9461');
    }
    expect(await balanceOf(sender.id)).toBe(100_000);
  });

  async function pendingTransfer() {
    const sender = await createUser(t.db, { phone: phoneFor(34), balance: 100_000 });
    const receiver = await createUser(t.db, { phone: phoneFor(35), balance: 0 });
    await t.db.update(users).set({ transactionPinHash: await bcrypt.hash('6842', 4) })
      .where(eq(users.id, sender.id));
    const session = sessionId();
    const f = flow(session, sender.phone);
    for (const input of [undefined, '2', receiver.phone, '1000']) await f(input);
    send.mockClear();
    return { sender, receiver, session, f };
  }

  it('keeps one receipt per transfer participant and does not resend on gateway retries', async () => {
    const { sender, receiver, session, f } = await pendingTransfer();
    expect((await f('6842')).text).toContain('Sent TSh 1,000');
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.filter(([n]) => n.to === sender.phone)).toHaveLength(1);
    expect(send.mock.calls.filter(([n]) => n.to === receiver.phone)).toHaveLength(1);
    expect(send.mock.calls[0]![0].message).toContain('You sent');
    expect(send.mock.calls[1]![0].message).toContain('You received');

    await post(session, sender.phone, `2*${receiver.phone}*1000*6842`);
    expect(send).toHaveBeenCalledTimes(2);
    expect(await balanceOf(receiver.id)).toBe(1000);
  });

  it('keeps one withdrawal receipt for the caller', async () => {
    const user = await createUser(t.db, { phone: phoneFor(37), balance: 100_000 });
    await t.db.update(users).set({ transactionPinHash: await bcrypt.hash('6842', 4) })
      .where(eq(users.id, user.id));
    const f = flow(sessionId(), user.phone);
    for (const input of [undefined, '3', '1000']) await f(input);
    send.mockClear();

    expect((await f('6842')).text).toContain('Withdrew TSh 1,000');
    expect(send).toHaveBeenCalledExactlyOnceWith({
      to: user.phone,
      message: expect.stringContaining('You withdrew'),
    });
    expect(await balanceOf(user.id)).toBe(98_989);
  });

  it('texts an administrator the outcome and preserves the credited customer receipt', async () => {
    const admin = await createAdmin(t.db, { phone: phoneFor(38) });
    const user = await createUser(t.db, { phone: phoneFor(39), balance: 0 });
    await t.db.update(admins).set({ pinHash: await bcrypt.hash('6842', 4) })
      .where(eq(admins.id, admin.id));
    const f = flow(sessionId(), admin.phone!);
    for (const input of [undefined, '6', '1', user.phone, '1', '2500', 'SMS deposit test', '1']) {
      await f(input);
    }
    send.mockClear();

    expect((await f('6842')).text).toContain('Done. Bal TSh 2,500');
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith({
      to: user.phone, message: expect.stringContaining('credited with'),
    });
    expect(send).toHaveBeenCalledWith({
      to: admin.phone, message: expect.stringContaining('USSD\nDone. Bal TSh 2,500'),
    });
    expect(await balanceOf(user.id)).toBe(2500);
  });

  it('does not send payment receipts if the outer USSD transaction rolls back', async () => {
    const { sender, receiver, f } = await pendingTransfer();
    vi.spyOn(ussdRepo, 'writeRequest').mockRejectedValueOnce(new Error('Simulated ledger failure'));
    const result = await f('6842');

    expect(result.text).toContain('Service is busy');
    expect(await balanceOf(sender.id)).toBe(100_000);
    expect(await balanceOf(receiver.id)).toBe(0);
    expect(send).toHaveBeenCalledExactlyOnceWith({
      to: sender.phone, message: 'USSD\nService is busy. Please dial again.',
    });
  });

  it('keeps USSD and committed transfers working when the SMS provider rejects sending', async () => {
    const { receiver, f } = await pendingTransfer();
    send.mockRejectedValue(new Error('SMS provider unavailable'));
    const result = await f('6842');
    expect(result.status).toBe(200);
    expect(result.text).toContain('Sent TSh 1,000');
    expect(await balanceOf(receiver.id)).toBe(1000);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not send SMS for unauthenticated or rate-limited callbacks', async () => {
    await t.agent().post('/api/ussd/callback').type('form').send({
      sessionId: sessionId(), phoneNumber: phoneFor(36), text: '',
    });
    expect(send).not.toHaveBeenCalled();

    const phone = phoneFor(36);
    for (let i = 0; i < env.USSD_RATE_LIMIT_PER_MIN; i++) {
      await post(sessionId(), phone, '');
    }
    send.mockClear();
    const result = await post(sessionId(), phone, '');
    expect(result.text).toContain('Too many requests');
    expect(send).not.toHaveBeenCalled();
  });
});
