import { and, desc, eq, gte, isNotNull, isNull, like, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { FRAUD } from '@fraud/shared';
import type { FraudPrediction, RiskLevel, TransactionStatus } from '@fraud/shared';
import type { Db } from '../db/client';
import { admins, transactions, users } from '../db/schema';
import { num } from '../lib/money';
import { darDateExpr } from '../modules/admin/transactions';
import { dayOnly } from './text';
import { phoneDigits } from './phone';

// Re-exported so the admin scenes read every account/audit helper from one module.
export type { AdminRow } from './repo';
export { recentSecurityEvents } from './repo';

/**
 * Compact read-only queries shaped for USSD screens (four rows at a time, no joins beyond what a
 * single screen renders). All writes go through the shared services in `modules/`; nothing here
 * mutates balances or transaction state.
 */

export type UserRow = typeof users.$inferSelect;
export type TxRow = typeof transactions.$inferSelect;

export interface CompactUser {
  id: number;
  fullName: string;
  phone: string;
  email: string;
  balance: number;
  cardLast4: string;
  status: 'active' | 'pending' | 'inactive';
  createdAt: Date;
}

export interface CompactTx {
  id: number;
  transactionId: string;
  senderId: number | null;
  receiverId: number | null;
  type: string;
  status: TransactionStatus;
  amount: number;
  senderName: string | null;
  receiverName: string | null;
  fraudPrediction: FraudPrediction | null;
  fraudScore: number;
  riskLevel: RiskLevel | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

const compactUser = (u: UserRow): CompactUser => ({
  id: u.id,
  fullName: u.fullName,
  phone: u.phone,
  email: u.email,
  balance: num(u.balance),
  cardLast4: u.cardNumber.slice(-4),
  status: u.isActive ? (u.isApproved ? 'active' : 'pending') : 'inactive',
  createdAt: u.createdAt,
});

const compactTx = (t: TxRow): CompactTx => ({
  id: t.id,
  transactionId: t.transactionId,
  senderId: t.senderId,
  receiverId: t.receiverId,
  type: t.transactionType,
  status: t.status,
  amount: num(t.amount),
  senderName: t.senderName,
  receiverName: t.receiverName,
  fraudPrediction: t.fraudPrediction,
  fraudScore: num(t.fraudScore),
  riskLevel: t.riskLevel,
  reviewedAt: t.reviewedAt,
  createdAt: t.createdAt,
});

const phoneDigitsOf = sql`replace(replace(${users.phone}, ' ', ''), '+', '')`;

export async function rawUserById(db: Db, id: number): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function rawUserByPhone(db: Db, phone: string): Promise<UserRow | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(sql`${phoneDigitsOf} = ${phoneDigits(phone)}`)
    .limit(1);
  return row ?? null;
}

export async function getUserById(db: Db, id: number): Promise<CompactUser | null> {
  const row = await rawUserById(db, id);
  return row ? compactUser(row) : null;
}

export interface Page {
  limit: number;
  offset: number;
}

export async function listUsers(db: Db, p: Page, search?: string): Promise<{ items: CompactUser[]; total: number }> {
  const where = search
    ? or(like(users.fullName, `%${search}%`), like(users.email, `%${search}%`), like(users.phone, `%${search}%`))
    : undefined;
  const [count] = await db.select({ c: sql<number>`count(*)` }).from(users).where(where);
  const rows = await db
    .select()
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(p.limit)
    .offset(p.offset);
  return { items: rows.map(compactUser), total: count?.c ?? 0 };
}

export async function listPendingUsers(db: Db, p: Page): Promise<{ items: CompactUser[]; total: number }> {
  const where = eq(users.isApproved, false);
  const [count] = await db.select({ c: sql<number>`count(*)` }).from(users).where(where);
  const rows = await db
    .select()
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(p.limit)
    .offset(p.offset);
  return { items: rows.map(compactUser), total: count?.c ?? 0 };
}

export interface TxFilter {
  status?: TransactionStatus;
  fraudOnly?: boolean;
  search?: string;
}

export async function listTransactions(
  db: Db,
  p: Page,
  f: TxFilter = {},
): Promise<{ items: CompactTx[]; total: number }> {
  const where = and(
    f.status ? eq(transactions.status, f.status) : undefined,
    f.fraudOnly ? eq(transactions.fraudPrediction, 'FRAUD') : undefined,
    f.search ? like(transactions.transactionId, `%${f.search}%`) : undefined,
  );
  const [count] = await db.select({ c: sql<number>`count(*)` }).from(transactions).where(where);
  const rows = await db
    .select()
    .from(transactions)
    .where(where)
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(p.limit)
    .offset(p.offset);
  return { items: rows.map(compactTx), total: count?.c ?? 0 };
}

export async function getUserTransactions(
  db: Db,
  userId: number,
  p: Page,
  search?: string,
): Promise<{ items: CompactTx[]; total: number }> {
  const mine = or(eq(transactions.senderId, userId), eq(transactions.receiverId, userId));
  const where = and(
    mine,
    search ? like(transactions.transactionId, `%${search}%`) : undefined,
  );
  const [count] = await db.select({ c: sql<number>`count(*)` }).from(transactions).where(where);
  const rows = await db
    .select()
    .from(transactions)
    .where(where)
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(p.limit)
    .offset(p.offset);
  return { items: rows.map(compactTx), total: count?.c ?? 0 };
}

export async function getTransaction(db: Db, id: number): Promise<CompactTx | null> {
  const [row] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return row ? compactTx(row) : null;
}

export async function findTransactionByRef(db: Db, ref: string, userId?: number): Promise<CompactTx | null> {
  const mine =
    userId === undefined
      ? undefined
      : or(eq(transactions.senderId, userId), eq(transactions.receiverId, userId));
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.transactionId, ref.trim().toUpperCase()), mine))
    .limit(1);
  return row ? compactTx(row) : null;
}

/** Unreviewed high-risk fraud alerts, the USSD equivalent of the web alerts page. */
export async function listHighRiskAlerts(
  db: Db,
  p: Page,
): Promise<{ items: CompactTx[]; total: number }> {
  const where = and(
    eq(transactions.fraudPrediction, 'FRAUD'),
    eq(transactions.riskLevel, 'HIGH'),
    isNull(transactions.reviewedAt),
  );
  const [count] = await db.select({ c: sql<number>`count(*)` }).from(transactions).where(where);
  const rows = await db
    .select()
    .from(transactions)
    .where(where)
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(p.limit)
    .offset(p.offset);
  return { items: rows.map(compactTx), total: count?.c ?? 0 };
}

/** The AI review queue: PENDING predictions that were scored above zero. */
export async function listReviewQueue(db: Db, p: Page): Promise<{ items: CompactTx[]; total: number }> {
  const where = and(eq(transactions.fraudPrediction, 'PENDING'), sql`${transactions.fraudScore} > 0`);
  const [count] = await db.select({ c: sql<number>`count(*)` }).from(transactions).where(where);
  const rows = await db
    .select()
    .from(transactions)
    .where(where)
    .orderBy(desc(transactions.fraudScore), desc(transactions.createdAt))
    .limit(p.limit)
    .offset(p.offset);
  return { items: rows.map(compactTx), total: count?.c ?? 0 };
}

export interface TodayReport {
  total: number;
  successful: number;
  aborted: number;
  pending: number;
  fraud: number;
  highRisk: number;
  moved: number;
  failedValue: number;
}

/** Today's figures in Dar es Salaam time, matching how the web report groups dates. */
export async function todayReport(db: Db, now: Date): Promise<TodayReport> {
  const today = dayOnly(now);
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      successful: sql<number>`cast(sum(case when ${transactions.status} = 'SUCCESS' then 1 else 0 end) as int)`,
      aborted: sql<number>`cast(sum(case when ${transactions.status} = 'ABORTED' then 1 else 0 end) as int)`,
      pending: sql<number>`cast(sum(case when ${transactions.status} = 'PENDING' then 1 else 0 end) as int)`,
      fraud: sql<number>`cast(sum(case when ${transactions.fraudPrediction} = 'FRAUD' then 1 else 0 end) as int)`,
      highRisk: sql<number>`cast(sum(case when ${transactions.riskLevel} = 'HIGH' then 1 else 0 end) as int)`,
      moved: sql<string>`coalesce(sum(case when ${transactions.status} = 'SUCCESS' then ${transactions.amount} else 0 end), 0)`,
      failedValue: sql<string>`coalesce(sum(case when ${transactions.status} = 'ABORTED' then ${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .where(sql`${darDateExpr} = ${today}`);
  return {
    total: row?.total ?? 0,
    successful: row?.successful ?? 0,
    aborted: row?.aborted ?? 0,
    pending: row?.pending ?? 0,
    fraud: row?.fraud ?? 0,
    highRisk: row?.highRisk ?? 0,
    moved: num(row?.moved),
    failedValue: num(row?.failedValue),
  };
}

export async function adminByPhone(db: Db, phone: string): Promise<typeof admins.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(admins)
    .where(sql`replace(replace(${admins.phone}, ' ', ''), '+', '') = ${phoneDigits(phone)}`)
    .limit(1);
  return row ?? null;
}

/** Unreviewed alert count used by the system-alerts screen. */
export async function countOpenAlerts(db: Db): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.fraudPrediction, 'FRAUD'),
        sql`${transactions.fraudScore} > ${FRAUD.ALERT_MIN_SCORE_EXCLUSIVE}`,
        isNull(transactions.reviewedAt),
      ),
    );
  return row?.c ?? 0;
}

/** Sender accounts with the most fraud-flagged transfers, as on the web fraud page. */
export async function topSuspects(
  db: Db,
  limit: number,
): Promise<{ id: number; fullName: string; fraudCount: number }[]> {
  return db
    .select({
      id: users.id,
      fullName: users.fullName,
      fraudCount: sql<number>`cast(count(${transactions.id}) as int)`,
    })
    .from(users)
    .innerJoin(transactions, eq(transactions.senderId, users.id))
    .where(and(eq(transactions.fraudPrediction, 'FRAUD'), isNotNull(users.id)))
    .groupBy(users.id, users.fullName)
    .orderBy(desc(sql`count(${transactions.id})`))
    .limit(limit);
}

/** Used by the reports screen for a 24-hour window of successful volume. */
export async function volumeSince(db: Db, since: Date): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(eq(transactions.status, 'SUCCESS'), gte(transactions.createdAt, since)));
  return num(row?.total);
}

export const txWhere = (w: SQL | undefined) => w;
