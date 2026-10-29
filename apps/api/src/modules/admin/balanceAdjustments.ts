import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { ADJUSTMENT_TYPES, PAGE_SIZES } from '@fraud/shared';
import type { BalanceAdjustmentsQuery, Paginated } from '@fraud/shared';
import type { Db } from '../../db/client';
import { admins, transactions, users } from '../../db/schema';
import { num } from '../../lib/money';
import { dateRange } from './transactions';

export interface AdjustmentLogRow {
  id: number;
  transactionId: string;
  amount: number;
  type: string;
  reason: string | null;
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
  adminId: number | null;
  adminName: string | null;
  adminUsername: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AdjustmentSummary {
  total: number;
  totalAmount: number;
  avgAmount: number;
  uniqueUsers: number;
  uniqueAdmins: number;
  byType: { type: string; count: number; total: number }[];
}

const adjustmentBase = inArray(transactions.transactionType, [...ADJUSTMENT_TYPES]);

export async function listBalanceAdjustments(
  db: Db,
  q: BalanceAdjustmentsQuery,
): Promise<Paginated<AdjustmentLogRow> & { summary: AdjustmentSummary }> {
  const pageSize = PAGE_SIZES.ADMIN;
  const like = q.search ? `%${q.search}%` : null;
  const where = and(
    adjustmentBase,
    like
      ? or(
          ilike(transactions.transactionId, like),
          ilike(users.fullName, like),
          ilike(users.email, like),
          ilike(transactions.message, like),
        )
      : undefined,
    q.type ? eq(transactions.transactionType, q.type) : undefined,
    q.adminId !== undefined ? eq(transactions.adminId, q.adminId) : undefined,
    dateRange(q.dateFrom, q.dateTo),
  );

  const joined = () =>
    db
      .select({
        tx: transactions,
        userName: users.fullName,
        userEmail: users.email,
        adminName: admins.fullName,
        adminUsername: admins.username,
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.receiverId, users.id))
      .leftJoin(admins, eq(transactions.adminId, admins.id))
      .where(where);

  const [count] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(transactions)
    .leftJoin(users, eq(transactions.receiverId, users.id))
    .leftJoin(admins, eq(transactions.adminId, admins.id))
    .where(where);
  const total = count?.c ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(q.page, totalPages);
  const rows = await joined()
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      totalAmount: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      avgAmount: sql<string>`coalesce(avg(${transactions.amount}), 0)`,
      uniqueUsers: sql<number>`count(distinct ${transactions.receiverId})::int`,
      uniqueAdmins: sql<number>`count(distinct ${transactions.adminId})::int`,
    })
    .from(transactions)
    .where(adjustmentBase);
  const byType = await db
    .select({
      type: transactions.transactionType,
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(adjustmentBase)
    .groupBy(transactions.transactionType)
    .orderBy(asc(transactions.transactionType));

  return {
    items: rows.map((r) => ({
      id: r.tx.id,
      transactionId: r.tx.transactionId,
      amount: num(r.tx.amount),
      type: r.tx.transactionType,
      reason: r.tx.message,
      userId: r.tx.receiverId,
      userName: r.userName ?? r.tx.receiverName,
      userEmail: r.userEmail,
      adminId: r.tx.adminId,
      adminName: r.adminName,
      adminUsername: r.adminUsername,
      ipAddress: r.tx.ipAddress,
      createdAt: r.tx.createdAt.toISOString(),
    })),
    page,
    pageSize,
    total,
    totalPages,
    summary: {
      total: stats?.total ?? 0,
      totalAmount: num(stats?.totalAmount),
      avgAmount: Math.round(num(stats?.avgAmount) * 100) / 100,
      uniqueUsers: stats?.uniqueUsers ?? 0,
      uniqueAdmins: stats?.uniqueAdmins ?? 0,
      byType: byType.map((b) => ({ type: b.type, count: b.count, total: num(b.total) })),
    },
  };
}

export async function listAdmins(db: Db): Promise<{ id: number; fullName: string; username: string }[]> {
  return db
    .select({ id: admins.id, fullName: admins.fullName, username: admins.username })
    .from(admins)
    .where(eq(admins.isActive, true))
    .orderBy(asc(admins.fullName));
}
