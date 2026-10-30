import { desc, sql } from 'drizzle-orm';
import { TIMEZONE } from '@fraud/shared';
import type { AdminUserRow } from '@fraud/shared';
import type { Db } from '../../db/client';
import { transactions, users } from '../../db/schema';
import { num } from '../../lib/money';
import { getCounters } from './counters';
import { alertBase } from './fraudAlerts';
import { queryTransactions } from './transactions';
import type { AdminTxRow } from './transactions';
import { toAdminUserRow } from './users';

export interface AdminDashboard {
  kpis: {
    totalUsers: number;
    totalTransactions: number;
    successful: number;
    aborted: number;
    moneyMoved: number;
    /** Fees earned from successful transfers and withdrawals. */
    revenueToday: number;
    revenueTotal: number;
    fraudDetected: number;
    highRisk: number;
    reviewQueue: number;
  };
  recentAlerts: AdminTxRow[];
  recentTransactions: AdminTxRow[];
  recentUsers: AdminUserRow[];
}

export async function getAdminDashboard(db: Db, now: Date): Promise<AdminDashboard> {
  // Revenue is the fee column on successful rows, bucketed by Dar es Salaam calendar day.
  const tz = sql.raw(`'${TIMEZONE}'`);
  const revenueBase = sql`${transactions.fee}`;
  const [[userCount], [tx], counters, alerts, recent, recentUsers] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(users),
    db
      .select({
        total: sql<number>`count(*)::int`,
        successful: sql<number>`count(*) filter (where ${transactions.status} = 'SUCCESS')::int`,
        aborted: sql<number>`count(*) filter (where ${transactions.status} = 'ABORTED')::int`,
        moneyMoved: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.status} = 'SUCCESS'), 0)`,
        revenueToday: sql<string>`coalesce(sum(${revenueBase}) filter (where ${transactions.status} = 'SUCCESS' and (${transactions.createdAt} at time zone ${tz})::date = (now() at time zone ${tz})::date), 0)`,
        revenueTotal: sql<string>`coalesce(sum(${revenueBase}) filter (where ${transactions.status} = 'SUCCESS'), 0)`,
        fraudDetected: sql<number>`count(*) filter (where ${transactions.fraudPrediction} = 'FRAUD')::int`,
      })
      .from(transactions),
    getCounters(db, now),
    queryTransactions(db, alertBase, 1, 5),
    queryTransactions(db, undefined, 1, 10),
    db.select().from(users).orderBy(desc(users.createdAt), desc(users.id)).limit(10),
  ]);
  return {
    kpis: {
      totalUsers: userCount?.c ?? 0,
      totalTransactions: tx?.total ?? 0,
      successful: tx?.successful ?? 0,
      aborted: tx?.aborted ?? 0,
      moneyMoved: num(tx?.moneyMoved),
      revenueToday: num(tx?.revenueToday),
      revenueTotal: num(tx?.revenueTotal),
      fraudDetected: tx?.fraudDetected ?? 0,
      highRisk: counters.highRisk,
      reviewQueue: counters.reviewQueue,
    },
    recentAlerts: alerts.items,
    recentTransactions: recent.items,
    recentUsers: recentUsers.map(toAdminUserRow),
  };
}
