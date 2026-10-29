import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { PAGE_SIZES, TIMEZONE } from '@fraud/shared';
import type {
  AdminTransactionsQuery,
  FraudPrediction,
  Paginated,
  Principal,
  RiskLevel,
  TransactionStatus,
  TransactionType,
} from '@fraud/shared';
import type { Db } from '../../db/client';
import { admins, transactions, users } from '../../db/schema';
import { HttpError } from '../../lib/errors';
import { num } from '../../lib/money';
import { fraudFilter } from '../users/transactions';
import { logAdminAction } from './audit';

export interface AdminTxRow {
  id: number;
  transactionId: string;
  senderId: number | null;
  senderName: string | null;
  receiverId: number | null;
  receiverName: string | null;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  fraudScore: number;
  fraudPrediction: FraudPrediction | null;
  riskLevel: RiskLevel | null;
  location: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface PartyInfo {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  balance: number;
}

export interface AdminTxDetails extends AdminTxRow {
  message: string | null;
  modelVersion: string | null;
  predictionTime: string | null;
  featureData: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  sender: PartyInfo | null;
  receiver: PartyInfo | null;
  admin: { id: number; fullName: string; username: string } | null;
  reviewedBy: number | null;
}

export const sender = alias(users, 'sender');
export const receiver = alias(users, 'receiver');

type Row = typeof transactions.$inferSelect;

/** Current party names: the live user name when the user still exists, else the stored snapshot. */
export function toAdminTxRow(
  r: Row,
  names: { senderName: string | null; receiverName: string | null },
): AdminTxRow {
  return {
    id: r.id,
    transactionId: r.transactionId,
    senderId: r.senderId,
    senderName: names.senderName ?? r.senderName,
    receiverId: r.receiverId,
    receiverName: names.receiverName ?? r.receiverName,
    amount: num(r.amount),
    type: r.transactionType,
    status: r.status,
    fraudScore: num(r.fraudScore),
    fraudPrediction: r.fraudPrediction,
    riskLevel: r.riskLevel,
    location: r.transactionLocation,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
  };
}

/** `(created_at in Dar es Salaam)::date` for date-range filters. */
export const darDateExpr = sql`(${transactions.createdAt} at time zone ${TIMEZONE})::date`;

export function dateRange(from?: string, to?: string): SQL | undefined {
  return and(
    from ? sql`${darDateExpr} >= ${from}::date` : undefined,
    to ? sql`${darDateExpr} <= ${to}::date` : undefined,
  );
}

/** Search over the transaction id and both party names (stored snapshot or live name). */
export function partySearch(term: string | undefined): SQL | undefined {
  if (!term) return undefined;
  const like = `%${term}%`;
  return or(
    ilike(transactions.transactionId, like),
    ilike(transactions.senderName, like),
    ilike(transactions.receiverName, like),
    ilike(sender.fullName, like),
    ilike(receiver.fullName, like),
  );
}

/** Joined, paginated transaction query shared by every admin listing. */
export async function queryTransactions(
  db: Db,
  where: SQL | undefined,
  page: number,
  pageSize: number = PAGE_SIZES.ADMIN,
): Promise<Paginated<AdminTxRow>> {
  const base = () =>
    db
      .select({ tx: transactions, senderName: sender.fullName, receiverName: receiver.fullName })
      .from(transactions)
      .leftJoin(sender, eq(transactions.senderId, sender.id))
      .leftJoin(receiver, eq(transactions.receiverId, receiver.id))
      .where(where);

  const [count] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(transactions)
    .leftJoin(sender, eq(transactions.senderId, sender.id))
    .leftJoin(receiver, eq(transactions.receiverId, receiver.id))
    .where(where);
  const total = count?.c ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const rows = await base()
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(pageSize)
    .offset((current - 1) * pageSize);
  return {
    items: rows.map((r) => toAdminTxRow(r.tx, r)),
    page: current,
    pageSize,
    total,
    totalPages,
  };
}

export async function listAdminTransactions(db: Db, q: AdminTransactionsQuery): Promise<Paginated<AdminTxRow>> {
  const where = and(
    partySearch(q.search),
    q.status ? eq(transactions.status, q.status) : undefined,
    q.type ? eq(transactions.transactionType, q.type) : undefined,
    q.riskLevel ? eq(transactions.riskLevel, q.riskLevel) : undefined,
    fraudFilter(q.fraud),
  );
  return queryTransactions(db, where, q.page);
}

async function party(db: Db, id: number | null): Promise<PartyInfo | null> {
  if (id === null) return null;
  const [u] = await db
    .select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone, balance: users.balance })
    .from(users)
    .where(eq(users.id, id));
  return u ? { ...u, balance: num(u.balance) } : null;
}

export async function getAdminTransaction(db: Db, id: number): Promise<AdminTxDetails> {
  const [row] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Transaction not found');
  const [s, r] = await Promise.all([party(db, row.senderId), party(db, row.receiverId)]);
  let admin: AdminTxDetails['admin'] = null;
  if (row.adminId !== null) {
    const [a] = await db
      .select({ id: admins.id, fullName: admins.fullName, username: admins.username })
      .from(admins)
      .where(eq(admins.id, row.adminId));
    admin = a ?? null;
  }
  return {
    ...toAdminTxRow(row, { senderName: s?.fullName ?? null, receiverName: r?.fullName ?? null }),
    message: row.message,
    modelVersion: row.modelVersion,
    predictionTime: row.predictionTime?.toISOString() ?? null,
    featureData: row.featureData ?? null,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    sender: s,
    receiver: r,
    admin,
    reviewedBy: row.reviewedBy,
  };
}

/** Marks a FRAUD transaction reviewed without touching its status. */
export async function markReviewed(db: Db, id: number, admin: Principal, ip: string | null, now: Date): Promise<void> {
  const [row] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  if (!row || row.fraudPrediction !== 'FRAUD') throw new HttpError(404, 'NOT_FRAUD', 'Transaction not found or not flagged as fraud');
  if (row.reviewedAt) throw new HttpError(409, 'ALREADY_REVIEWED', 'Transaction already reviewed');
  await db.transaction(async (tx) => {
    await tx.update(transactions).set({ reviewedAt: now, reviewedBy: admin.id }).where(eq(transactions.id, id));
    await logAdminAction(tx, {
      adminId: admin.id,
      adminName: admin.name,
      actionType: 'mark_reviewed',
      userId: row.senderId,
      userName: row.senderName,
      amount: num(row.amount),
      reason: 'Fraud alert reviewed',
      details: `Transaction ${row.transactionId} marked as reviewed`,
      ip,
    });
  });
}
