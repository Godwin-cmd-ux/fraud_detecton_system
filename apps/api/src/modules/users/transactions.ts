import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { PAGE_SIZES } from '@fraud/shared';
import type { Paginated, TransactionListItem, UserTransactionsQuery } from '@fraud/shared';
import type { Db } from '../../db/client';
import { transactions } from '../../db/schema';
import { num } from '../../lib/money';

type Row = typeof transactions.$inferSelect;

export function toListItem(row: Row, userId: number): TransactionListItem {
  let direction: TransactionListItem['direction'];
  let counterpartyName: string | null;
  if (row.transactionType === 'withdrawal') {
    direction = 'withdrawal';
    counterpartyName = null;
  } else if (row.transactionType !== 'transfer') {
    direction = 'deposit';
    counterpartyName = null;
  } else if (row.senderId === userId) {
    direction = 'sent';
    counterpartyName = row.receiverName;
  } else {
    direction = 'received';
    counterpartyName = row.senderName;
  }
  return {
    id: row.id,
    transactionId: row.transactionId,
    type: row.transactionType,
    direction,
    counterpartyName,
    amount: num(row.amount),
    status: row.status,
    fraudScore: num(row.fraudScore),
    fraudPrediction: row.fraudPrediction,
    riskLevel: row.riskLevel,
    message: row.message,
    location: row.transactionLocation,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Filter fragment for the `fraud` query parameter shared by user and admin listings. */
export function fraudFilter(value: 'fraud' | 'legit' | 'pending' | undefined): SQL | undefined {
  switch (value) {
    case 'fraud':
      return eq(transactions.fraudPrediction, 'FRAUD');
    case 'legit':
      return eq(transactions.fraudPrediction, 'LEGIT');
    case 'pending':
      return or(eq(transactions.fraudPrediction, 'PENDING'), isNull(transactions.fraudPrediction));
    default:
      return undefined;
  }
}

export async function listUserTransactions(
  db: Db,
  userId: number,
  q: UserTransactionsQuery,
): Promise<Paginated<TransactionListItem>> {
  const pageSize = PAGE_SIZES.USER_TRANSACTIONS;
  const where = and(
    or(eq(transactions.senderId, userId), eq(transactions.receiverId, userId)),
    q.search
      ? or(ilike(transactions.transactionId, `%${q.search}%`), ilike(transactions.message, `%${q.search}%`))
      : undefined,
    q.status ? eq(transactions.status, q.status) : undefined,
    fraudFilter(q.fraud),
  );
  const [count] = await db.select({ c: sql<number>`count(*)::int` }).from(transactions).where(where);
  const total = count?.c ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(q.page, totalPages);
  const rows = await db
    .select()
    .from(transactions)
    .where(where)
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { items: rows.map((r) => toListItem(r, userId)), page, pageSize, total, totalPages };
}

export async function recentUserTransactions(db: Db, userId: number, limit: number): Promise<TransactionListItem[]> {
  const rows = await db
    .select()
    .from(transactions)
    .where(or(eq(transactions.senderId, userId), eq(transactions.receiverId, userId)))
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(limit);
  return rows.map((r) => toListItem(r, userId));
}
