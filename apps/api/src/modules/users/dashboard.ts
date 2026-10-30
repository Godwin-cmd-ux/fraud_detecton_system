import { and, eq, isNotNull, or, sql } from 'drizzle-orm';
import type { TransactionListItem } from '@fraud/shared';
import type { Db } from '../../db/client';
import { transactions } from '../../db/schema';
import { HttpError } from '../../lib/errors';
import { num } from '../../lib/money';
import { findActiveUserById } from './repo';
import { recentUserTransactions } from './transactions';

export interface UserDashboard {
  user: {
    id: number;
    fullName: string;
    email: string;
    phone: string;
    card: { number: string; expiry: string | null; cvc: string | null };
    location: string | null;
    createdAt: string;
  };
  /** Only present when the session has recently verified the password. */
  balance: number | null;
  stats: { total: number; successful: number; aborted: number; pending: number; successRate: number };
  fraud: { analyzed: number; fraud: number; legit: number; avgScore: number; maxScore: number };
  recent: TransactionListItem[];
}

export async function getDashboard(db: Db, userId: number, revealBalance: boolean): Promise<UserDashboard> {
  const user = await findActiveUserById(db, userId);
  if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Your account is no longer active');

  const mine = or(eq(transactions.senderId, userId), eq(transactions.receiverId, userId));
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      successful: sql<number>`count(*) filter (where ${transactions.status} = 'SUCCESS')::int`,
      aborted: sql<number>`count(*) filter (where ${transactions.status} = 'ABORTED')::int`,
      pending: sql<number>`count(*) filter (where ${transactions.status} = 'PENDING')::int`,
    })
    .from(transactions)
    .where(mine);
  const [fraud] = await db
    .select({
      analyzed: sql<number>`count(*)::int`,
      fraud: sql<number>`count(*) filter (where ${transactions.fraudPrediction} = 'FRAUD')::int`,
      legit: sql<number>`count(*) filter (where ${transactions.fraudPrediction} = 'LEGIT')::int`,
      avgScore: sql<string>`coalesce(avg(${transactions.fraudScore}), 0)`,
      maxScore: sql<string>`coalesce(max(${transactions.fraudScore}), 0)`,
    })
    .from(transactions)
    .where(and(mine, isNotNull(transactions.fraudPrediction)));

  const total = stats?.total ?? 0;
  const successful = stats?.successful ?? 0;
  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      card: { number: user.cardNumber, expiry: user.cardExpiry, cvc: user.cardCvc },
      location: user.lastKnownLocation,
      createdAt: user.createdAt.toISOString(),
    },
    balance: revealBalance ? num(user.balance) : null,
    stats: {
      total,
      successful,
      aborted: stats?.aborted ?? 0,
      pending: stats?.pending ?? 0,
      successRate: total === 0 ? 0 : Math.round((successful / total) * 100),
    },
    fraud: {
      analyzed: fraud?.analyzed ?? 0,
      fraud: fraud?.fraud ?? 0,
      legit: fraud?.legit ?? 0,
      avgScore: Math.round(num(fraud?.avgScore) * 10) / 10,
      maxScore: num(fraud?.maxScore),
    },
    recent: await recentUserTransactions(db, userId, 5),
  };
}
