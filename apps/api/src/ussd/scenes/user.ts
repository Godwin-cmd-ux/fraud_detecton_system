import { DEFAULT_LOCATION, FRAUD, LOCATIONS } from '@fraud/shared';
import type { Location, TransferResult, WithdrawalResult } from '@fraud/shared';
import { HttpError } from '../../lib/errors';
import { num } from '../../lib/money';
import { executeTransfer } from '../../modules/transactions/transfer';
import { executeWithdrawal } from '../../modules/transactions/withdrawal';
import { choose, defineScene, parseAmount, parseIndex } from '../machine';
import type { Ctx, Result } from '../machine';
import { normalizePhone } from '../phone';
import { PIN_POLICY, readPinState, verifyPin } from '../pin';
import {
  findTransactionByRef,
  getTransaction,
  getUserTransactions,
  rawUserByPhone,
} from '../queries';
import type { CompactTx, UserRow } from '../queries';
import { amount, firstName, money, shortDate, STATUS_LABEL, txLine } from '../text';
import { handlePinFailure, PIN_PROMPT } from './pin';

/**
 * The customer dashboard. Every financial action calls the same services the web interface uses
 * (`executeTransfer`, `executeWithdrawal`), so fraud rules, velocity windows, ML scoring, balance
 * locking and the ledger are identical across both channels.
 */

const PAGE = 4;

const me = (c: Ctx): UserRow => {
  if (!c.meUser) throw new HttpError(401, 'UNAUTHENTICATED', 'Account not found');
  return c.meUser;
};

const transferDeps = (c: Ctx) => ({ db: c.db, ml: c.ml, now: () => c.now });

/** USSD has no GPS; the customer's last known city keeps location scoring meaningful. */
const locationOf = (u: UserRow): Location =>
  u.lastKnownLocation && (LOCATIONS as readonly string[]).includes(u.lastKnownLocation)
    ? (u.lastKnownLocation as Location)
    : DEFAULT_LOCATION;

const statusOf = (u: UserRow): string => (!u.isActive ? 'SUSPENDED' : !u.isApproved ? 'PENDING' : 'ACTIVE');

const mainMenu = (name: string) =>
  [
    `Welcome ${firstName(name)}`,
    '1. My Account',
    '2. Send Money',
    '3. Withdraw',
    '4. Transactions',
    '5. Balance',
    '6. Profile',
    '7. Help',
    '0. Exit',
  ].join('\n');

const accountScreen = (u: UserRow) =>
  ['MY ACCOUNT', u.fullName, u.phone, statusOf(u), `Joined ${shortDate(u.createdAt)}`, '0. Back'].join('\n');

const balanceScreen = (u: UserRow) => ['AVAILABLE BALANCE', money(num(u.balance)), 'Currency TZS', '0. Back'].join('\n');

const profileScreen = (u: UserRow) =>
  ['PROFILE', u.fullName, u.email, `Card ****${u.cardNumber.slice(-4)}`, '0. Back'].join('\n');

const HELP = [
  'HELP',
  'Send and receive money',
  'with real-time fraud checks.',
  'Fraud blocked? Contact support',
  'through the web app.',
  '0. Back',
].join('\n');

const directionOf = (t: CompactTx, userId: number): string =>
  t.type === 'withdrawal' ? 'WDL' : t.type !== 'transfer' ? 'IN' : t.senderId === userId ? 'SENT' : 'RECV';

const txText = (t: CompactTx, userId: number): string =>
  [
    `REF ${t.transactionId}`,
    `${directionOf(t, userId)} ${money(t.amount)}`,
    `Status ${t.status}`,
    `Fraud ${t.fraudScore}% ${t.riskLevel ?? 'n/a'}`,
    `${shortDate(t.createdAt)}`,
    '0. Back',
  ].join('\n');

function transferScreen(r: TransferResult, value: number, receiver: string): string {
  if (r.outcome === 'success') {
    const head = `Sent ${money(value)} to ${receiver}`;
    const extra = r.flaggedForReview ? '\nFlagged for review' : '';
    return `${head}\nRef ${r.transactionId}\nRisk ${r.riskScore}% ${r.riskLevel}${extra}`;
  }
  return `Blocked: ${r.reason ?? 'Fraud detected'}\nRef ${r.transactionId}\nRisk ${r.riskScore}% ${r.riskLevel}`;
}

function withdrawalScreen(r: WithdrawalResult, value: number): string {
  if (r.outcome === 'failed') {
    return `${r.message}\nFailed attempts ${r.failedAttempts}/${FRAUD.FAILED_WITHDRAWAL_BLOCK_COUNT}`;
  }
  if (r.outcome === 'blocked') {
    return `Blocked: ${r.reason}\nRef ${r.transactionId}\nRisk ${r.riskScore}% ${r.riskLevel}`;
  }
  return `Withdrew ${money(value)}\nRef ${r.transactionId}\nRisk ${r.riskScore}% ${r.riskLevel}`;
}

defineScene(
  'user.main',
  async (c) =>
    choose(
      c,
      () => mainMenu(me(c).fullName),
      {
        '1': async () => ({ text: accountScreen(me(c)), scene: 'user.account' }),
        '2': async () => ({
          text: 'SEND MONEY\nEnter recipient phone\n0. Back',
          scene: 'user.send.phone',
          clearData: true,
        }),
        '3': async () => {
          const u = me(c);
          return {
            text: `WITHDRAW\nAvailable ${money(num(u.balance))}\nEnter amount\n0. Back`,
            scene: 'user.withdraw.amount',
            clearData: true,
          };
        },
        '4': async () => ({
          text: 'TRANSACTIONS\n1. Latest\n2. Search by ref\n0. Back',
          scene: 'user.tx.menu',
          clearData: true,
          data: { page: '1' },
        }),
        '5': async () => ({ text: balanceScreen(me(c)), scene: 'user.balance' }),
        '6': async () => ({ text: profileScreen(me(c)), scene: 'user.profile' }),
        '7': async () => ({ text: HELP, scene: 'user.help' }),
      },
    ),
  'user',
);

defineScene('user.account', async (c) => ({ text: accountScreen(me(c)) }), 'user');
defineScene('user.balance', async (c) => ({ text: balanceScreen(me(c)) }), 'user');
defineScene('user.profile', async (c) => ({ text: profileScreen(me(c)) }), 'user');
defineScene('user.help', async () => ({ text: HELP }), 'user');

defineScene(
  'user.send.phone',
  async (c) => {
    const u = me(c);
    const prompt = 'SEND MONEY\nEnter recipient phone\n0. Back';
    if (c.input === '') return { text: prompt };

    const phone = normalizePhone(c.input);
    if (!phone) return { text: `Invalid number.\n${prompt}` };

    const recipient = await rawUserByPhone(c.db, phone);
    if (!recipient || recipient.id === u.id || !recipient.isActive || !recipient.isApproved) {
      return { text: `Not an active registered number.\n${prompt}` };
    }

    return {
      text: `To ${recipient.fullName}\n${recipient.phone}\nEnter amount (TSh)\n0. Back`,
      scene: 'user.send.amount',
      data: { rid: String(recipient.id), rname: recipient.fullName },
    };
  },
  'user',
);

defineScene(
  'user.send.amount',
  async (c) => {
    const u = me(c);
    const rid = Number(c.state.data.rid ?? 0);
    const rname = c.state.data.rname ?? '';
    if (!rid) return { text: 'Session expired. Dial again.', end: true, clearData: true };

    const prompt = `To ${rname}\nEnter amount (TSh)\n0. Back`;
    if (c.input === '') return { text: prompt };

    const value = parseAmount(c.input);
    if (value === null) return { text: `Invalid amount.\n${prompt}` };

    const balance = num(u.balance);
    if (value > balance) {
      return { text: `Insufficient balance ${money(balance)}.\n${prompt}` };
    }
    if (value > FRAUD.EXTREME_AMOUNT) {
      return { text: `Maximum per transfer is ${money(FRAUD.EXTREME_AMOUNT)}.\n${prompt}` };
    }

    // Ask for PIN enrolment here rather than promising a PIN check the customer cannot pass.
    const pin = await readPinState(c.db, 'user', u.id, c.now);
    if (pin.isLocked) return { text: `PIN locked for ${pin.minutesLeft} min.\nTry again later.`, end: true };
    if (!pin.isSet) {
      return {
        text: `SEND ${money(value)} to ${rname}\nPIN required\n1. Set PIN\n0. Cancel`,
        scene: 'user.send.pin',
        data: { amount: String(value) },
      };
    }

    return {
      text: `SEND ${money(value)} to ${rname}\n${PIN_PROMPT}\n0. Cancel`,
      scene: 'user.send.pin',
      data: { amount: String(value) },
    };
  },
  'user',
);

defineScene(
  'user.send.pin',
  async (c) => {
    const u = me(c);
    const rid = Number(c.state.data.rid ?? 0);
    const value = Number(c.state.data.amount ?? 0);
    const rname = c.state.data.rname ?? '';
    if (!rid || !value) return { text: 'Session expired. Dial again.', end: true, clearData: true };

    const pin = await readPinState(c.db, 'user', u.id, c.now);
    if (pin.isLocked) return { text: `PIN locked for ${pin.minutesLeft} min.\nTry again later.`, end: true };

    if (!pin.isSet) {
      const ask = 'PIN required to send money.\n1. Set PIN\n0. Cancel';
      if (c.input !== '1') return { text: ask, scene: 'user.send.pin' };
      return {
        text: `Set transaction PIN\n${PIN_PROMPT}\n0. Cancel`,
        scene: 'pin.new',
        data: { return: 'user.send.pin' },
      };
    }

    if (c.input === '') return { text: `SEND ${money(value)} to ${rname}\n${PIN_PROMPT}\n0. Cancel` };

    const check = await verifyPin(c.db, 'user', u.id, c.input, c.now);
    if (!check.ok) return handlePinFailure(c, check, 'user.send.pin');

    const result = await executeTransfer(transferDeps(c), {
      userId: u.id,
      receiverId: rid,
      amount: value,
      location: locationOf(u),
      message: 'USSD transfer',
      ip: c.ip,
      userAgent: c.userAgent,
    });
    return { text: transferScreen(result, value, rname), end: true, clearData: true };
  },
  'user',
);

defineScene(
  'user.withdraw.amount',
  async (c) => {
    const u = me(c);
    const balance = num(u.balance);
    const prompt = `WITHDRAW\nAvailable ${money(balance)}\nEnter amount\n0. Back`;
    if (c.input === '') return { text: prompt };

    const value = parseAmount(c.input);
    if (value === null) return { text: `Invalid amount.\n${prompt}` };
    if (value < FRAUD.MIN_WITHDRAWAL) {
      return { text: `Minimum withdrawal is ${money(FRAUD.MIN_WITHDRAWAL)}.\n${prompt}` };
    }
    if (value > balance) return { text: `Insufficient balance ${money(balance)}.\n${prompt}` };

    const pin = await readPinState(c.db, 'user', u.id, c.now);
    if (pin.isLocked) return { text: `PIN locked for ${pin.minutesLeft} min.\nTry again later.`, end: true };
    if (!pin.isSet) {
      return {
        text: `WITHDRAW ${money(value)}\nPIN required\n1. Set PIN\n0. Cancel`,
        scene: 'user.withdraw.pin',
        data: { amount: String(value) },
      };
    }

    return {
      text: `WITHDRAW ${money(value)}\nBalance after ${money(balance - value)}\n${PIN_PROMPT}\n0. Cancel`,
      scene: 'user.withdraw.pin',
      data: { amount: String(value) },
    };
  },
  'user',
);

defineScene(
  'user.withdraw.pin',
  async (c) => {
    const u = me(c);
    const value = Number(c.state.data.amount ?? 0);
    if (!value) return { text: 'Session expired. Dial again.', end: true, clearData: true };

    const pin = await readPinState(c.db, 'user', u.id, c.now);
    if (pin.isLocked) return { text: `PIN locked for ${pin.minutesLeft} min.\nTry again later.`, end: true };

    if (!pin.isSet) {
      const ask = 'PIN required to withdraw.\n1. Set PIN\n0. Cancel';
      if (c.input !== '1') return { text: ask, scene: 'user.withdraw.pin' };
      return {
        text: `Set transaction PIN\n${PIN_PROMPT}\n0. Cancel`,
        scene: 'pin.new',
        data: { return: 'user.withdraw.pin' },
      };
    }

    if (c.input === '') return { text: `WITHDRAW ${money(value)}\n${PIN_PROMPT}\n0. Cancel` };

    const check = await verifyPin(c.db, 'user', u.id, c.input, c.now);
    if (!check.ok) return handlePinFailure(c, check, 'user.withdraw.pin');

    const result = await executeWithdrawal(transferDeps(c), {
      userId: u.id,
      amount: value,
      location: locationOf(u),
      message: 'USSD withdrawal',
      ip: c.ip,
      userAgent: c.userAgent,
    });

    // An insufficient balance is a retryable outcome in this workflow, not a terminal error.
    if (result.outcome === 'failed') {
      return {
        text: `${withdrawalScreen(result, value)}\n0. Back`,
        scene: 'user.withdraw.amount',
        data: { amount: '' },
      };
    }
    return { text: withdrawalScreen(result, value), end: true, clearData: true };
  },
  'user',
);

/** Renders one page of the customer's history; shared by the menu entry and the pager. */
async function renderTxPage(c: Ctx, u: UserRow, requested: number) {
  let page = Math.max(1, requested);
  let result = await getUserTransactions(c.db, u.id, { limit: PAGE, offset: (page - 1) * PAGE });
  const pages = Math.max(1, Math.ceil(result.total / PAGE));
  if (page > pages) {
    page = pages;
    result = await getUserTransactions(c.db, u.id, { limit: PAGE, offset: (page - 1) * PAGE });
  }
  if (result.items.length === 0) {
    return { text: 'TRANSACTIONS\nNo transactions yet.\n0. Back', items: [], page, pages };
  }
  const lines = [`TRANSACTIONS ${page}/${pages}`];
  result.items.forEach((t, i) => lines.push(txLine(i + 1, directionOf(t, u.id), t.amount, t.status)));
  if (page < pages) lines.push('9. Next');
  lines.push('0. Back');
  return { text: lines.join('\n'), items: result.items, page, pages };
}

defineScene(
  'user.tx.menu',
  async (c) =>
    choose(
      c,
      () => 'TRANSACTIONS\n1. Latest\n2. Search by ref\n0. Back',
      {
        '1': async () => {
          const listed = await renderTxPage(c, me(c), 1);
          return { text: listed.text, scene: 'user.tx.list', data: { page: '1' } };
        },
        '2': async () => ({ text: 'SEARCH\nEnter transaction ref\n0. Back', scene: 'user.tx.search' }),
      },
    ),
  'user',
);

defineScene(
  'user.tx.list',
  async (c): Promise<Result> => {
    const u = me(c);
    const current = Math.max(1, Number(c.state.data.page ?? '1') || 1);
    const listed = await renderTxPage(c, u, c.input === '9' ? current + 1 : current);

    const index = parseIndex(c.input, listed.items.length);
    if (index) {
      const chosen = listed.items[index - 1]!;
      return {
        text: txText(chosen, u.id),
        scene: 'user.tx.view',
        data: { tid: String(chosen.id), page: String(listed.page) },
      };
    }
    return { text: listed.text, scene: 'user.tx.list', data: { page: String(listed.page) } };
  },
  'user',
);

defineScene(
  'user.tx.view',
  async (c) => {
    const u = me(c);
    const id = Number(c.state.data.tid ?? 0);
    const tx = id ? await getTransaction(c.db, id) : null;
    if (!tx || (tx.senderId !== u.id && tx.receiverId !== u.id)) {
      return { text: 'Transaction not found.\n0. Back', scene: 'user.tx.list' };
    }
    return { text: txText(tx, u.id) };
  },
  'user',
);

defineScene(
  'user.tx.search',
  async (c) => {
    const u = me(c);
    const prompt = 'SEARCH\nEnter transaction ref\n0. Back';
    if (c.input === '') return { text: prompt };
    const tx = await findTransactionByRef(c.db, c.input, u.id);
    if (!tx) return { text: `No transaction ${c.input.toUpperCase()}.\n${prompt}` };
    return { text: txText(tx, u.id), scene: 'user.tx.view', data: { tid: String(tx.id) } };
  },
  'user',
);
