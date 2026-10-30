import { FRAUD } from '@fraud/shared';
import type { AdjustmentType, Principal } from '@fraud/shared';
import { HttpError } from '../../lib/errors';
import { getAdminDashboard } from '../../modules/admin/dashboard';
import { getCounters } from '../../modules/admin/counters';
import { getFraudOverview } from '../../modules/admin/overview';
import { markReviewed } from '../../modules/admin/transactions';
import { addBalance, deleteUser, rejectUser, setUserFlag } from '../../modules/admin/users';
import { choose, defineScene, parseAmount, parseAmountOrZero, parseIndex } from '../machine';
import type { Ctx, Result } from '../machine';
import { normalizePhone } from '../phone';
import { PIN_POLICY, readPinState, verifyPin } from '../pin';
import {
  countOpenAlerts,
  findTransactionByRef,
  getTransaction,
  getUserById,
  getUserTransactions,
  listHighRiskAlerts,
  listPendingUsers,
  listReviewQueue,
  listTransactions,
  listUsers,
  rawUserByPhone,
  recentSecurityEvents,
  todayReport,
  topSuspects,
} from '../queries';
import type { AdminRow, CompactTx, CompactUser } from '../queries';
import { createUserViaUssd } from '../register';
import { amount as numText, compact, firstName, money, shortDate, txLine } from '../text';
import { handlePinFailure } from './pin';

/**
 * Administrator dashboard. Every mutation goes through the same service the web admin uses
 * (`setUserFlag`, `rejectUser`, `addBalance`, `markReviewed`, `deleteUser`), so audit rows, ledger
 * entries and approval semantics are identical. Each scene is registered with `'admin'` scope, and
 * the dispatcher re-checks the caller's role on every callback.
 */

const PAGE = 4;

const ADJUST_LABEL: Record<AdjustmentType, string> = {
  deposit: 'Deposit',
  bonus: 'Bonus',
  refund: 'Refund',
  adjustment: 'Adjustment',
};

const meAdmin = (c: Ctx): AdminRow => {
  if (!c.meAdmin) throw new HttpError(401, 'UNAUTHENTICATED', 'Administrator account not found');
  return c.meAdmin;
};

const principal = (c: Ctx): Principal => {
  const a = meAdmin(c);
  return { kind: 'admin', id: a.id, name: a.fullName, email: a.email };
};

const statusTag = (u: CompactUser): string =>
  u.status === 'active' ? 'ACT' : u.status === 'pending' ? 'PEND' : 'SUSP';

const userLine = (i: number, u: CompactUser): string =>
  `${i}.${firstName(u.fullName)} ${numText(u.balance)} ${statusTag(u)}`;

const userScreen = (u: CompactUser) =>
  [
    `#${u.id} ${u.fullName}`,
    `${statusTag(u)} ${money(u.balance)}`,
    u.phone,
    '1. Transactions',
    '2. Account actions',
    '3. Balance adjust',
    '0. Back',
  ].join('\n');

const dirOf = (t: CompactTx): string =>
  t.type === 'withdrawal' ? 'WDL' : t.senderId === null ? 'IN' : 'OUT';

const txScreen = (t: CompactTx): string => {
  const party =
    t.senderId === null
      ? t.receiverName
        ? `To ${t.receiverName}`
        : ''
      : t.senderName
        ? `From ${t.senderName}`
        : '';
  const lines = [
    `REF ${t.transactionId}`,
    `${dirOf(t)} ${money(t.amount)}`,
    `${t.status} Fraud ${t.fraudScore}%`,
    party,
    shortDate(t.createdAt),
  ];
  if (t.fraudPrediction === 'FRAUD' && !t.reviewedAt) lines.push('1. Mark reviewed');
  lines.push('0. Back');
  return lines.filter(Boolean).join('\n');
};

interface PageResult {
  text: string;
  items: CompactUser[];
  page: number;
  pages: number;
}

async function renderUserPage(c: Ctx, mode: string, requested: number, q?: string): Promise<PageResult> {
  const load = (p: number) =>
    mode === 'pending'
      ? listPendingUsers(c.db, { limit: PAGE, offset: (p - 1) * PAGE })
      : listUsers(c.db, { limit: PAGE, offset: (p - 1) * PAGE }, q);

  let page = Math.max(1, requested);
  let res = await load(page);
  const pages = Math.max(1, Math.ceil(res.total / PAGE));
  if (page > pages) {
    page = pages;
    res = await load(page);
  }

  const title = mode === 'pending' ? 'APPROVALS' : q ? 'SEARCH' : 'USERS';
  if (res.items.length === 0) {
    return { text: `${title}\nNothing to show.\n0. Back`, items: [], page, pages };
  }
  const lines = [`${title} ${page}/${pages} (${res.total})`];
  res.items.forEach((u, i) => lines.push(userLine(i + 1, u)));
  if (page < pages) lines.push('9. Next');
  lines.push('0. Back');
  return { text: lines.join('\n'), items: res.items, page, pages };
}

interface TxPageResult {
  text: string;
  items: CompactTx[];
  page: number;
  pages: number;
}

async function renderAdminTxPage(c: Ctx, mode: string, requested: number): Promise<TxPageResult> {
  const filter =
    mode === 'success'
      ? { status: 'SUCCESS' as const }
      : mode === 'failed'
        ? { status: 'ABORTED' as const }
        : mode === 'flagged'
          ? { fraudOnly: true }
          : {};
  const load = (p: number) => listTransactions(c.db, { limit: PAGE, offset: (p - 1) * PAGE }, filter);

  let page = Math.max(1, requested);
  let res = await load(page);
  const pages = Math.max(1, Math.ceil(res.total / PAGE));
  if (page > pages) {
    page = pages;
    res = await load(page);
  }

  const title = { latest: 'ALL TX', success: 'SUCCESS', failed: 'FAILED', flagged: 'FLAGGED' }[mode] ?? 'TX';
  if (res.items.length === 0) {
    return { text: `${title}\nNo transactions.\n0. Back`, items: [], page, pages };
  }
  const lines = [`${title} ${page}/${pages} (${res.total})`];
  res.items.forEach((t, i) => lines.push(txLine(i + 1, dirOf(t), t.amount, t.status)));
  if (page < pages) lines.push('9. Next');
  lines.push('0. Back');
  return { text: lines.join('\n'), items: res.items, page, pages };
}

async function renderUserTxPage(c: Ctx, uid: number, requested: number): Promise<TxPageResult> {
  const load = (p: number) => getUserTransactions(c.db, uid, { limit: PAGE, offset: (p - 1) * PAGE });
  let page = Math.max(1, requested);
  let res = await load(page);
  const pages = Math.max(1, Math.ceil(res.total / PAGE));
  if (page > pages) {
    page = pages;
    res = await load(page);
  }
  if (res.items.length === 0) return { text: 'USER TX\nNo transactions.\n0. Back', items: [], page, pages };
  const lines = [`USER TX ${page}/${pages} (${res.total})`];
  res.items.forEach((t, i) => lines.push(txLine(i + 1, dirOf(t), t.amount, t.status)));
  if (page < pages) lines.push('9. Next');
  lines.push('0. Back');
  return { text: lines.join('\n'), items: res.items, page, pages };
}

const mainMenu = (name: string) =>
  [
    `ADMIN ${firstName(name)}`,
    '1. Overview',
    '2. Users',
    '3. Approvals',
    '4. Create User',
    '5. Transactions',
    '6. More',
    '0. Exit',
  ].join('\n');

const moreMenu = [
  'ADMIN MENU 2',
  '1. Balances',
  '2. Fraud',
  '3. Alerts',
  '4. Review Queue',
  '5. System',
  '6. Reports',
  '7. My Account',
  '0. Back',
].join('\n');

const txMenu = [
  'TRANSACTIONS',
  '1. Latest',
  '2. Successful',
  '3. Failed',
  '4. Flagged',
  '5. Search ref',
  '0. Back',
].join('\n');

defineScene(
  'admin.main',
  async (c) =>
    choose(
      c,
      () => mainMenu(meAdmin(c).fullName),
      {
        '1': async () => ({ text: await overviewText(c), scene: 'admin.overview' }),
        '2': async () => ({ text: usersMenu, scene: 'admin.users.menu', clearData: true, data: { mode: 'all', page: '1' } }),
        '3': async () => {
          const listed = await renderUserPage(c, 'pending', 1);
          return { text: listed.text, scene: 'admin.approvals.list', clearData: true, data: { page: '1' } };
        },
        '4': async () => ({
          text: 'CREATE USER 1/6\nEnter full name\n0. Cancel',
          scene: 'admin.create.name',
          clearData: true,
        }),
        '5': async () => ({ text: txMenu, scene: 'admin.tx.menu', clearData: true, data: { mode: 'latest', page: '1' } }),
        '6': async () => ({ text: moreMenu, scene: 'admin.more' }),
      },
    ),
  'admin',
);

const usersMenu = ['USERS', '1. Latest', '2. By phone', '3. By name', '4. By ID', '0. Back'].join('\n');

async function overviewText(c: Ctx): Promise<string> {
  const d = await getAdminDashboard(c.db, c.now);
  return [
    'OVERVIEW',
    `Users ${d.kpis.totalUsers}`,
    `Tx ${d.kpis.totalTransactions} OK ${d.kpis.successful}`,
    `Failed ${d.kpis.aborted} Fraud ${d.kpis.fraudDetected}`,
    `High ${d.kpis.highRisk} Review ${d.kpis.reviewQueue}`,
    `Moved ${money(d.kpis.moneyMoved)}`,
    '0. Back',
  ].join('\n');
}

defineScene('admin.overview', async (c) => ({ text: await overviewText(c) }), 'admin');

defineScene(
  'admin.more',
  async (c) =>
    choose(
      c,
      () => moreMenu,
      {
        '1': async () => ({
          text: 'BALANCES\nEnter customer phone\n0. Back',
          scene: 'admin.balance.phone',
          clearData: true,
        }),
        '2': async () => ({ text: await fraudText(c), scene: 'admin.fraud.overview', clearData: true }),
        '3': async () => {
          const listed = await alertsPage(c, 1);
          return { text: listed.text, scene: 'admin.alerts.list', data: { page: '1' } };
        },
        '4': async () => {
          const listed = await queuePage(c, 1);
          return { text: listed.text, scene: 'admin.review.list', data: { page: '1' } };
        },
        '5': async () => ({ text: await systemText(c), scene: 'admin.system' }),
        '6': async () => ({ text: await reportText(c), scene: 'admin.reports' }),
        '7': async () => {
          const a = meAdmin(c);
          return {
            text: [
              'MY ACCOUNT',
              a.fullName,
              `@${a.username}`,
              a.email,
              a.phone ?? 'No phone bound',
              a.lastLogin ? `Last login ${shortDate(a.lastLogin)}` : 'Never signed in',
              '0. Back',
            ].join('\n'),
            scene: 'admin.me',
          };
        },
      },
    ),
  'admin',
);

/* ------------------------------- users ---------------------------------- */

defineScene(
  'admin.users.menu',
  async (c) =>
    choose(
      c,
      () => usersMenu,
      {
        '1': async () => {
          const listed = await renderUserPage(c, 'all', 1);
          return { text: listed.text, scene: 'admin.users.list', data: { mode: 'all', page: '1' } };
        },
        '2': async () => ({ text: 'FIND USER\nEnter phone number\n0. Back', scene: 'admin.users.phone' }),
        '3': async () => ({ text: 'FIND USER\nEnter name\n0. Back', scene: 'admin.users.name' }),
        '4': async () => ({ text: 'FIND USER\nEnter user ID\n0. Back', scene: 'admin.users.id' }),
      },
    ),
  'admin',
);

defineScene(
  'admin.users.list',
  async (c): Promise<Result> => {
    const mode = c.state.data.mode ?? 'all';
    const q = c.state.data.q || undefined;
    const current = Math.max(1, Number(c.state.data.page ?? '1') || 1);
    const listed = await renderUserPage(c, mode, c.input === '9' ? current + 1 : current, q);

    const index = parseIndex(c.input, listed.items.length);
    if (index) {
      const u = listed.items[index - 1]!;
      return {
        text: userScreen(u),
        scene: 'admin.users.view',
        data: { uid: String(u.id), page: String(listed.page), mode, ...(q ? { q } : {}) },
      };
    }
    return { text: listed.text, scene: 'admin.users.list', data: { page: String(listed.page), mode } };
  },
  'admin',
);

defineScene(
  'admin.users.phone',
  async (c) => {
    const prompt = 'FIND USER\nEnter phone number\n0. Back';
    if (c.input === '') return { text: prompt };
    const phone = normalizePhone(c.input);
    if (!phone) return { text: `Invalid number.\n${prompt}` };
    const row = await rawUserByPhone(c.db, phone);
    if (!row) return { text: `No account for ${phone}.\n${prompt}` };
    const u = await getUserById(c.db, row.id);
    if (!u) return { text: `No account for ${phone}.\n${prompt}` };
    return { text: userScreen(u), scene: 'admin.users.view', data: { uid: String(u.id) } };
  },
  'admin',
);

defineScene(
  'admin.users.name',
  async (c) => {
    const prompt = 'FIND USER\nEnter name\n0. Back';
    if (c.input === '') return { text: prompt };
    if (c.input.trim().length < 2) return { text: `Enter at least 2 letters.\n${prompt}` };
    const listed = await renderUserPage(c, 'name', 1, c.input.trim());
    return { text: listed.text, scene: 'admin.users.list', data: { mode: 'name', q: c.input.trim(), page: '1' } };
  },
  'admin',
);

defineScene(
  'admin.users.id',
  async (c) => {
    const prompt = 'FIND USER\nEnter user ID\n0. Back';
    if (c.input === '') return { text: prompt };
    if (!/^\d+$/.test(c.input)) return { text: `ID must be a number.\n${prompt}` };
    const u = await getUserById(c.db, Number(c.input));
    if (!u) return { text: `No user #${c.input}.\n${prompt}` };
    return { text: userScreen(u), scene: 'admin.users.view', data: { uid: String(u.id) } };
  },
  'admin',
);

defineScene(
  'admin.users.view',
  async (c) => {
    const uid = Number(c.state.data.uid ?? 0);
    const u = uid ? await getUserById(c.db, uid) : null;
    if (!u) return { text: 'User not found.\n0. Back', scene: 'admin.users.menu' };

    return choose(
      c,
      () => userScreen(u),
      {
        '1': async () => {
          const listed = await renderUserTxPage(c, u.id, 1);
          return { text: listed.text, scene: 'admin.users.tx', data: { page: '1' } };
        },
        '2': async () => ({
          text: [
            `#${u.id} ${u.fullName}`,
            '1. Approve  2. Disapprove',
            '3. Suspend  4. Activate',
            '5. Delete',
            '0. Back',
          ].join('\n'),
          scene: 'admin.users.actions',
        }),
        '3': async () => ({
          text: [
            `#${u.id} ${u.fullName}`,
            `Bal ${money(u.balance)}`,
            '1. Deposit  2. Bonus',
            '3. Refund   4. Adjustment',
            '0. Back',
          ].join('\n'),
          scene: 'admin.balance.type',
          data: { uid: String(u.id), uname: u.fullName },
        }),
      },
    );
  },
  'admin',
);

defineScene(
  'admin.users.tx',
  async (c): Promise<Result> => {
    const uid = Number(c.state.data.uid ?? 0);
    const current = Math.max(1, Number(c.state.data.page ?? '1') || 1);
    const listed = await renderUserTxPage(c, uid, c.input === '9' ? current + 1 : current);
    const index = parseIndex(c.input, listed.items.length);
    if (index) {
      const t = listed.items[index - 1]!;
      return { text: txScreen(t), scene: 'admin.tx.view', data: { tid: String(t.id) } };
    }
    return { text: listed.text, scene: 'admin.users.tx', data: { page: String(listed.page) } };
  },
  'admin',
);

defineScene(
  'admin.users.actions',
  async (c) => {
    const uid = Number(c.state.data.uid ?? 0);
    const u = uid ? await getUserById(c.db, uid) : null;
    if (!u) return { text: 'User not found.\n0. Back', scene: 'admin.users.menu' };

    const apply = async (action: 'approve' | 'disapprove' | 'activate' | 'deactivate'): Promise<Result> => {
      const res = await setUserFlag(c.db, u.id, action, principal(c), c.ip, 'Changed by admin via USSD');
      return { text: `${res.message}\n0. Back`, scene: 'admin.users.view' };
    };

    return choose(
      c,
      () => [
        `#${u.id} ${u.fullName}`,
        '1. Approve  2. Disapprove',
        '3. Suspend  4. Activate',
        '5. Delete',
        '0. Back',
      ].join('\n'),
      {
        '1': async () => apply('approve'),
        '2': async () => apply('disapprove'),
        '3': async () => apply('deactivate'),
        '4': async () => apply('activate'),
        '5': async () => ({
          text: `Delete ${u.fullName}?\nTransactions are kept.\n1. Confirm  0. Cancel`,
          scene: 'admin.users.delete',
        }),
      },
    );
  },
  'admin',
);

defineScene(
  'admin.users.delete',
  async (c) => {
    const uid = Number(c.state.data.uid ?? 0);
    if (c.input !== '1') return { text: 'Delete cancelled.\n0. Back', scene: 'admin.users.view' };
    const res = await deleteUser(c.db, uid, principal(c), c.ip);
    return { text: `${res.message}\n0. Back`, scene: 'admin.users.menu', clearData: true };
  },
  'admin',
);

/* ----------------------------- approvals -------------------------------- */

defineScene(
  'admin.approvals.list',
  async (c): Promise<Result> => {
    const current = Math.max(1, Number(c.state.data.page ?? '1') || 1);
    const listed = await renderUserPage(c, 'pending', c.input === '9' ? current + 1 : current);
    const index = parseIndex(c.input, listed.items.length);
    if (index) {
      const u = listed.items[index - 1]!;
      return {
        text: `#${u.id} ${u.fullName}\n${u.phone}\n${u.email}\n1. Approve  2. Reject\n0. Back`,
        scene: 'admin.approvals.view',
        data: { uid: String(u.id) },
      };
    }
    return { text: listed.text, scene: 'admin.approvals.list', data: { page: String(listed.page) } };
  },
  'admin',
);

defineScene(
  'admin.approvals.view',
  async (c) => {
    const uid = Number(c.state.data.uid ?? 0);
    const u = uid ? await getUserById(c.db, uid) : null;
    if (!u) return { text: 'User not found.\n0. Back', scene: 'admin.approvals.list' };

    if (c.input === '1') {
      const res = await setUserFlag(c.db, u.id, 'approve', principal(c), c.ip, 'Approved via USSD');
      return { text: `${res.message}\n0. Back`, scene: 'admin.approvals.list' };
    }
    if (c.input === '2') {
      return { text: `Reject ${u.fullName}?\n1. Confirm  0. Cancel`, scene: 'admin.approvals.reason' };
    }
    return { text: `#${u.id} ${u.fullName}\n${u.phone}\n${u.email}\n1. Approve  2. Reject\n0. Back` };
  },
  'admin',
);

defineScene(
  'admin.approvals.reason',
  async (c) => {
    const uid = Number(c.state.data.uid ?? 0);
    if (c.input === '') return { text: 'Enter rejection reason\n0. Cancel' };
    if (c.input === '1' && !c.state.data.awaitingReason) {
      // First press of "confirm" asks for the reason.
      return { text: 'Enter rejection reason\n0. Cancel', data: { awaitingReason: '1' } };
    }
    if (c.input.trim().length < 3) return { text: 'Reason too short.\n0. Cancel' };
    const res = await rejectUser(c.db, uid, c.input.trim(), principal(c), c.ip);
    return { text: `${res.message}\n0. Back`, scene: 'admin.approvals.list', clearData: true };
  },
  'admin',
);

/* ------------------------------ create ---------------------------------- */

defineScene(
  'admin.create.name',
  async (c) => {
    if (c.input === '') return { text: 'CREATE USER 1/6\nEnter full name\n0. Cancel' };
    if (c.input.trim().length < 3) return { text: 'Name too short.\nEnter full name' };
    return {
      text: 'CREATE USER 2/6\nEnter email\n0. Cancel',
      scene: 'admin.create.email',
      data: { name: c.input.trim() },
    };
  },
  'admin',
);

defineScene(
  'admin.create.email',
  async (c) => {
    if (c.input === '') return { text: 'CREATE USER 2/6\nEnter email\n0. Cancel' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.input.trim())) {
      return { text: 'Invalid email.\nEnter email' };
    }
    return {
      text: 'CREATE USER 3/6\nEnter phone (+255...)\n0. Cancel',
      scene: 'admin.create.phone',
      data: { email: c.input.trim().toLowerCase() },
    };
  },
  'admin',
);

defineScene(
  'admin.create.phone',
  async (c) => {
    const prompt = 'CREATE USER 3/6\nEnter phone (+255...)\n0. Cancel';
    if (c.input === '') return { text: prompt };
    const phone = normalizePhone(c.input);
    if (!phone) return { text: `Invalid number.\n${prompt}` };
    const existing = await rawUserByPhone(c.db, phone);
    if (existing) return { text: `Number already in use.\n${prompt}` };
    return {
      text: 'CREATE USER 4/6\nEnter 16-digit card no.\n0. Cancel',
      scene: 'admin.create.card',
      data: { phone },
    };
  },
  'admin',
);

defineScene(
  'admin.create.card',
  async (c) => {
    const prompt = 'CREATE USER 4/6\nEnter 16-digit card no.\n0. Cancel';
    if (c.input === '') return { text: prompt };
    const card = c.input.replace(/\s+/g, '');
    if (!/^\d{16,20}$/.test(card)) return { text: `Card must be 16-20 digits.\n${prompt}` };
    return {
      text: 'CREATE USER 5/6\nOpening balance (TSh)\n0. Cancel',
      scene: 'admin.create.amount',
      data: { card },
    };
  },
  'admin',
);

defineScene(
  'admin.create.amount',
  async (c) => {
    const prompt = 'CREATE USER 5/6\nOpening balance (TSh)\n0. Cancel';
    if (c.input === '') return { text: prompt };
    const value = parseAmountOrZero(c.input);
    if (value === null) return { text: `Invalid amount.\n${prompt}` };
    return {
      text: 'CREATE USER 6/6\nApprove immediately?\n1. Yes  2. No (pending)\n0. Cancel',
      scene: 'admin.create.approve',
      data: { amount: String(value) },
    };
  },
  'admin',
);

defineScene(
  'admin.create.approve',
  async (c) => {
    const choice = c.input === '' ? '1' : c.input;
    if (choice !== '1' && choice !== '2') {
      return { text: 'Choose 1 or 2.', scene: 'admin.create.approve' };
    }
    const data = c.state.data;
    const summary = [
      'CREATE USER',
      data.name ?? '',
      `${data.email ?? ''}`,
      `${data.phone ?? ''}`,
      `Card ****${(data.card ?? '').slice(-4)}`,
      `Open ${money(Number(data.amount ?? 0))}`,
    ].join('\n');

    const pin = await readPinState(c.db, 'admin', meAdmin(c).id, c.now);
    if (pin.isLocked) return { text: `Admin PIN locked ${pin.minutesLeft} min.`, end: true };
    if (!pin.isSet) {
      if (c.input === '1' || c.input === '2') {
        return {
          text: `No admin PIN.\n${summary}\n1. Set PIN\n0. Cancel`,
          scene: 'admin.create.pin',
          data: { approved: choice === '1' ? '1' : '0', summary },
        };
      }
    }
    return {
      text: `${summary}\n${approvedLine(choice)}\nEnter admin PIN\n0. Cancel`,
      scene: 'admin.create.pin',
      data: { approved: choice === '1' ? '1' : '0', summary },
    };
  },
  'admin',
);

const approvedLine = (choice: string): string => (choice === '1' ? 'Status: approved' : 'Status: pending');

defineScene(
  'admin.create.pin',
  async (c) => {
    const a = meAdmin(c);
    const data = c.state.data;
    const pin = await readPinState(c.db, 'admin', a.id, c.now);

    if (pin.isLocked) return { text: `Admin PIN locked ${pin.minutesLeft} min.`, end: true };
    if (!pin.isSet) {
      const ask = `No admin PIN set.\n1. Set PIN\n0. Cancel`;
      if (c.input !== '1') return { text: ask, scene: 'admin.create.pin' };
      return {
        text: `Set administrator PIN\nEnter ${PIN_POLICY.length} digits\n0. Cancel`,
        scene: 'pin.new',
        data: { return: 'admin.create.pin' },
      };
    }
    if (c.input === '') {
      return { text: `${data.summary ?? ''}\nEnter admin PIN\n0. Cancel` };
    }

    const check = await verifyPin(c.db, 'admin', a.id, c.input, c.now);
    if (!check.ok) return handlePinFailure(c, check, 'admin.create.pin');

    const created = await createUserViaUssd(
      c.db,
      {
        fullName: data.name ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        cardNumber: data.card ?? '',
        initialBalance: Number(data.amount ?? 0),
        isApproved: data.approved === '1',
      },
      principal(c),
      c.ip,
    );

    return {
      text: [
        `User created #${created.id}`,
        `${data.name ?? ''}`,
        `Web password: use Forgot`,
        'Password on the website.',
      ].join('\n'),
      end: true,
      clearData: true,
    };
  },
  'admin',
);

/* --------------------------- transactions ------------------------------- */

defineScene(
  'admin.tx.menu',
  async (c) =>
    choose(
      c,
      () => txMenu,
      {
        '1': async () => {
          const listed = await renderAdminTxPage(c, 'latest', 1);
          return { text: listed.text, scene: 'admin.tx.list', data: { mode: 'latest', page: '1' } };
        },
        '2': async () => {
          const listed = await renderAdminTxPage(c, 'success', 1);
          return { text: listed.text, scene: 'admin.tx.list', data: { mode: 'success', page: '1' } };
        },
        '3': async () => {
          const listed = await renderAdminTxPage(c, 'failed', 1);
          return { text: listed.text, scene: 'admin.tx.list', data: { mode: 'failed', page: '1' } };
        },
        '4': async () => {
          const listed = await renderAdminTxPage(c, 'flagged', 1);
          return { text: listed.text, scene: 'admin.tx.list', data: { mode: 'flagged', page: '1' } };
        },
        '5': async () => ({ text: 'SEARCH TX\nEnter reference\n0. Back', scene: 'admin.tx.search' }),
      },
    ),
  'admin',
);

defineScene(
  'admin.tx.list',
  async (c): Promise<Result> => {
    const mode = c.state.data.mode ?? 'latest';
    const current = Math.max(1, Number(c.state.data.page ?? '1') || 1);
    const listed = await renderAdminTxPage(c, mode, c.input === '9' ? current + 1 : current);
    const index = parseIndex(c.input, listed.items.length);
    if (index) {
      const t = listed.items[index - 1]!;
      return { text: txScreen(t), scene: 'admin.tx.view', data: { tid: String(t.id), mode } };
    }
    return { text: listed.text, scene: 'admin.tx.list', data: { page: String(listed.page), mode } };
  },
  'admin',
);

defineScene(
  'admin.tx.search',
  async (c) => {
    const prompt = 'SEARCH TX\nEnter reference\n0. Back';
    if (c.input === '') return { text: prompt };
    const t = await findTransactionByRef(c.db, c.input);
    if (!t) return { text: `Not found: ${c.input.toUpperCase()}.\n${prompt}` };
    return { text: txScreen(t), scene: 'admin.tx.view', data: { tid: String(t.id) } };
  },
  'admin',
);

defineScene(
  'admin.tx.view',
  async (c) => {
    const id = Number(c.state.data.tid ?? 0);
    const t = id ? await getTransaction(c.db, id) : null;
    if (!t) return { text: 'Transaction not found.\n0. Back', scene: 'admin.tx.menu' };

    return choose(
      c,
      () => txScreen(t),
      {
        '1': async () => {
          if (t.fraudPrediction !== 'FRAUD') {
            return { text: 'Only fraud-flagged transactions can be reviewed.\n0. Back' };
          }
          if (t.reviewedAt) return { text: 'Already reviewed.\n0. Back' };
          await markReviewed(c.db, t.id, principal(c), c.ip, c.now);
          return { text: 'Marked as reviewed.\n0. Back' };
        },
      },
    );
  },
  'admin',
);

/* ------------------------------ fraus/queues ----------------------------- */

async function fraudText(c: Ctx): Promise<string> {
  const o = await getFraudOverview(c.db, c.now);
  return [
    'FRAUD OVERVIEW',
    `Analyzed ${o.stats.total}`,
    `Fraud ${o.stats.fraud} Legit ${o.stats.legit}`,
    `High ${o.stats.highRisk} Med ${o.stats.mediumRisk}`,
    `Avg ${o.stats.avgScore} Max ${o.stats.maxScore}`,
    '1. Top suspects',
    '0. Back',
  ].join('\n');
}

defineScene(
  'admin.fraud.overview',
  async (c) =>
    choose(
      c,
      () => fraudText(c),
      {
        '1': async () => {
          const suspects = await topSuspects(c.db, 5);
          const lines = ['TOP SUSPECTS'];
          suspects.forEach((s, i) => lines.push(`${i + 1}.${firstName(s.fullName)} ${s.fraudCount} flags`));
          lines.push('0. Back');
          return { text: lines.join('\n'), scene: 'admin.fraud.suspects' };
        },
      },
    ),
  'admin',
);

async function alertsPage(c: Ctx, requested: number): Promise<TxPageResult> {
  const load = (p: number) => listHighRiskAlerts(c.db, { limit: PAGE, offset: (p - 1) * PAGE });
  let page = Math.max(1, requested);
  let res = await load(page);
  const pages = Math.max(1, Math.ceil(res.total / PAGE));
  if (page > pages) {
    page = pages;
    res = await load(page);
  }
  if (res.items.length === 0) return { text: 'HIGH RISK ALERTS\nNo open alerts.\n0. Back', items: [], page, pages };
  const lines = [`HIGH RISK ${page}/${pages} (${res.total})`];
  res.items.forEach((t, i) => lines.push(txLine(i + 1, dirOf(t), t.amount, t.status)));
  if (page < pages) lines.push('9. Next');
  lines.push('0. Back');
  return { text: lines.join('\n'), items: res.items, page, pages };
}

defineScene(
  'admin.alerts.list',
  async (c): Promise<Result> => {
    const current = Math.max(1, Number(c.state.data.page ?? '1') || 1);
    const listed = await alertsPage(c, c.input === '9' ? current + 1 : current);
    const index = parseIndex(c.input, listed.items.length);
    if (index) {
      const t = listed.items[index - 1]!;
      return { text: txScreen(t), scene: 'admin.tx.view', data: { tid: String(t.id) } };
    }
    return { text: listed.text, scene: 'admin.alerts.list', data: { page: String(listed.page) } };
  },
  'admin',
);

async function queuePage(c: Ctx, requested: number): Promise<TxPageResult> {
  const load = (p: number) => listReviewQueue(c.db, { limit: PAGE, offset: (p - 1) * PAGE });
  let page = Math.max(1, requested);
  let res = await load(page);
  const pages = Math.max(1, Math.ceil(res.total / PAGE));
  if (page > pages) {
    page = pages;
    res = await load(page);
  }
  if (res.items.length === 0) return { text: 'REVIEW QUEUE\nEmpty.\n0. Back', items: [], page, pages };
  const lines = [`REVIEW QUEUE ${page}/${pages} (${res.total})`];
  res.items.forEach((t, i) => lines.push(txLine(i + 1, dirOf(t), t.amount, t.status)));
  if (page < pages) lines.push('9. Next');
  lines.push('0. Back');
  return { text: lines.join('\n'), items: res.items, page, pages };
}

defineScene(
  'admin.review.list',
  async (c): Promise<Result> => {
    const current = Math.max(1, Number(c.state.data.page ?? '1') || 1);
    const listed = await queuePage(c, c.input === '9' ? current + 1 : current);
    const index = parseIndex(c.input, listed.items.length);
    if (index) {
      const t = listed.items[index - 1]!;
      return { text: txScreen(t), scene: 'admin.tx.view', data: { tid: String(t.id) } };
    }
    return { text: listed.text, scene: 'admin.review.list', data: { page: String(listed.page) } };
  },
  'admin',
);

/* ------------------------------- system --------------------------------- */

async function systemText(c: Ctx): Promise<string> {
  const [k, open, events] = await Promise.all([
    getCounters(c.db, c.now),
    countOpenAlerts(c.db),
    recentSecurityEvents(c.db, 3),
  ]);
  const lines = [
    'SYSTEM',
    `New users 24h ${k.newUsers24h}`,
    `Pending ${k.pendingUsers}`,
    `Failed 24h ${k.aborted24h}`,
    `Alerts ${open} Queue ${k.reviewQueue}`,
  ];
  if (events.length) lines.push(`Security: ${events[0]!.eventType}`);
  lines.push('0. Back');
  return lines.join('\n');
}

defineScene('admin.system', async (c) => ({ text: await systemText(c) }), 'admin');

async function reportText(c: Ctx): Promise<string> {
  const r = await todayReport(c.db, c.now);
  return [
    'TODAY',
    `Tx ${r.total} OK ${r.successful}`,
    `Failed ${r.aborted} Pend ${r.pending}`,
    `Fraud ${r.fraud} High ${r.highRisk}`,
    `Moved ${money(r.moved)}`,
    `Failed value ${money(r.failedValue)}`,
    '0. Back',
  ].join('\n');
}

defineScene('admin.reports', async (c) => ({ text: await reportText(c) }), 'admin');
defineScene('admin.fraud.suspects', async (c) => ({ text: await fraudText(c) }), 'admin');
defineScene('admin.me', async (c) => {
  const a = meAdmin(c);
  return {
    text: ['MY ACCOUNT', a.fullName, `@${a.username}`, a.email, a.phone ?? 'No phone bound', '0. Back'].join('\n'),
  };
}, 'admin');

/* ------------------------------- balances -------------------------------- */

defineScene(
  'admin.balance.phone',
  async (c) => {
    const prompt = 'BALANCES\nEnter customer phone\n0. Back';
    if (c.input === '') return { text: prompt };
    const phone = normalizePhone(c.input);
    if (!phone) return { text: `Invalid number.\n${prompt}` };
    const row = await rawUserByPhone(c.db, phone);
    if (!row) return { text: `No account for ${phone}.\n${prompt}` };
    const u = await getUserById(c.db, row.id);
    if (!u) return { text: `No account for ${phone}.\n${prompt}` };
    return {
      text: [
        `#${u.id} ${u.fullName}`,
        `Bal ${money(u.balance)}`,
        '1. Deposit  2. Bonus',
        '3. Refund   4. Adjustment',
        '0. Back',
      ].join('\n'),
      scene: 'admin.balance.type',
      data: { uid: String(u.id), uname: u.fullName },
    };
  },
  'admin',
);

defineScene(
  'admin.balance.type',
  async (c) => {
    const uid = Number(c.state.data.uid ?? 0);
    const u = uid ? await getUserById(c.db, uid) : null;
    if (!u) return { text: 'User not found.\n0. Back', scene: 'admin.balance.phone' };

    const types: Record<string, AdjustmentType> = {
      '1': 'deposit',
      '2': 'bonus',
      '3': 'refund',
      '4': 'adjustment',
    };
    const type = types[c.input];
    const screen = [
      `#${u.id} ${u.fullName}`,
      `Bal ${money(u.balance)}`,
      '1. Deposit  2. Bonus',
      '3. Refund   4. Adjustment',
      '0. Back',
    ].join('\n');

    if (!type) return { text: c.input === '' ? screen : `Invalid choice.\n${screen}` };
    return {
      text: `${ADJUST_LABEL[type]}\nEnter amount (TSh)\n0. Back`,
      scene: 'admin.balance.amount',
      data: { type },
    };
  },
  'admin',
);

defineScene(
  'admin.balance.amount',
  async (c) => {
    const prompt = `${ADJUST_LABEL[(c.state.data.type as AdjustmentType) ?? 'deposit']}\nEnter amount (TSh)\n0. Back`;
    if (c.input === '') return { text: prompt };
    const value = parseAmount(c.input);
    if (value === null) return { text: `Invalid amount.\n${prompt}` };
    if (value > FRAUD.MAX_ADMIN_ADJUSTMENT) {
      return { text: `Maximum is ${money(FRAUD.MAX_ADMIN_ADJUSTMENT)}.\n${prompt}` };
    }
    return { text: 'Enter reason\n0. Cancel', scene: 'admin.balance.reason', data: { amount: String(value) } };
  },
  'admin',
);

defineScene(
  'admin.balance.reason',
  async (c) => {
    if (c.input === '') return { text: 'Enter reason\n0. Cancel' };
    if (c.input.trim().length < 3) return { text: 'Reason too short.\n0. Cancel' };
    const data = c.state.data;
    const type = (data.type ?? 'deposit') as AdjustmentType;
    const summary = [
      `${data.uname ?? ''} (#${data.uid ?? ''})`,
      `${ADJUST_LABEL[type]} ${money(Number(data.amount ?? 0))}`,
      `Reason: ${c.input.trim()}`,
    ].join('\n');
    return {
      text: `${summary}\n1. Confirm  0. Cancel`,
      scene: 'admin.balance.confirm',
      data: { reason: c.input.trim(), summary },
    };
  },
  'admin',
);

defineScene(
  'admin.balance.confirm',
  async (c) => {
    const summary = c.state.data.summary ?? '';
    if (c.input !== '1') return { text: 'Cancelled.\n0. Back', scene: 'admin.more', clearData: true };

    const a = meAdmin(c);
    const pin = await readPinState(c.db, 'admin', a.id, c.now);
    if (pin.isLocked) return { text: `Admin PIN locked ${pin.minutesLeft} min.`, end: true };
    if (!pin.isSet) {
      return {
        text: `No admin PIN.\n${summary}\n1. Set PIN\n0. Cancel`,
        scene: 'admin.balance.pin',
      };
    }
    return { text: `${summary}\nEnter admin PIN\n0. Cancel`, scene: 'admin.balance.pin' };
  },
  'admin',
);

defineScene(
  'admin.balance.pin',
  async (c) => {
    const a = meAdmin(c);
    const data = c.state.data;
    const pin = await readPinState(c.db, 'admin', a.id, c.now);

    if (pin.isLocked) return { text: `Admin PIN locked ${pin.minutesLeft} min.`, end: true };
    if (!pin.isSet) {
      const ask = `No admin PIN set.\n1. Set PIN\n0. Cancel`;
      if (c.input !== '1') return { text: ask, scene: 'admin.balance.pin' };
      return {
        text: `Set administrator PIN\nEnter ${PIN_POLICY.length} digits\n0. Cancel`,
        scene: 'pin.new',
        data: { return: 'admin.balance.pin' },
      };
    }
    if (c.input === '') return { text: `${data.summary ?? ''}\nEnter admin PIN\n0. Cancel` };

    const check = await verifyPin(c.db, 'admin', a.id, c.input, c.now);
    if (!check.ok) return handlePinFailure(c, check, 'admin.balance.pin');

    const result = await addBalance(
      c.db,
      Number(data.uid ?? 0),
      {
        amount: Number(data.amount ?? 0),
        type: (data.type ?? 'deposit') as AdjustmentType,
        reason: data.reason ?? 'Adjustment via USSD',
      },
      principal(c),
      c.ip,
      c.userAgent,
      c.now,
    );

    return {
      text: [
        `Done. Bal ${money(result.newBalance)}`,
        `Ref ${result.transactionId}`,
        `By ${a.fullName}`,
      ].join('\n'),
      end: true,
      clearData: true,
    };
  },
  'admin',
);
