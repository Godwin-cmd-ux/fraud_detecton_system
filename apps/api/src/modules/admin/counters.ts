import { and, eq, gt, gte, isNull, sql } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { transactions, users } from '../../db/schema';
import { hoursAgo } from '../../lib/time';
import { alertBase } from './fraudAlerts';

export interface AdminCounters {
  newUsers24h: number;
  pendingUsers: number;
  aborted24h: number;
  fraudAlerts: number;
  highRisk: number;
  reviewQueue: number;
}

/** The "AI Review Queue" is defined once here: PENDING predictions with a score (see spec §8). */
export const reviewQueueWhere = and(eq(transactions.fraudPrediction, 'PENDING'), gt(transactions.fraudScore, sql`0`))!;

export async function getCounters(db: Db, now: Date): Promise<AdminCounters> {
  const dayAgo = hoursAgo(now, 24);
  const count = (where: ReturnType<typeof and>) =>
    db.select({ c: sql<number>`count(*)::int` }).from(transactions).where(where);

  const [[newUsers], [pending], [aborted], [alerts], [high], [queue]] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(users).where(gte(users.createdAt, dayAgo)),
    db.select({ c: sql<number>`count(*)::int` }).from(users).where(eq(users.isApproved, false)),
    count(and(eq(transactions.status, 'ABORTED'), gte(transactions.createdAt, dayAgo))),
    count(and(alertBase, isNull(transactions.reviewedAt))),
    count(eq(transactions.riskLevel, 'HIGH')),
    count(reviewQueueWhere),
  ]);
  return {
    newUsers24h: newUsers?.c ?? 0,
    pendingUsers: pending?.c ?? 0,
    aborted24h: aborted?.c ?? 0,
    fraudAlerts: alerts?.c ?? 0,
    highRisk: high?.c ?? 0,
    reviewQueue: queue?.c ?? 0,
  };
}
