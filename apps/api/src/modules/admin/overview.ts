import { desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { TIMEZONE } from '@fraud/shared';
import type { Db } from '../../db/client';
import { transactions, users } from '../../db/schema';
import { num } from '../../lib/money';
import { darDate } from '../../lib/time';

export interface FraudOverview {
  stats: {
    total: number;
    fraud: number;
    legit: number;
    pending: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    avgScore: number;
    maxScore: number;
    minScore: number;
    highPct: number;
    mediumPct: number;
    lowPct: number;
  };
  daily: { date: string; total: number; fraud: number; legit: number }[];
  byType: { type: string; total: number; fraud: number }[];
  byHour: { hour: number; total: number; fraud: number }[];
  topSuspects: { id: number; fullName: string; email: string; fraudCount: number; totalAmount: number }[];
}

const DAYS = 7;
const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);
const fraudCount = sql<number>`count(*) filter (where ${transactions.fraudPrediction} = 'FRAUD')::int`;
const legitCount = sql<number>`count(*) filter (where ${transactions.fraudPrediction} = 'LEGIT')::int`;

export async function getFraudOverview(db: Db, now: Date): Promise<FraudOverview> {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      fraud: fraudCount,
      legit: legitCount,
      pending: sql<number>`count(*) filter (where ${transactions.fraudPrediction} = 'PENDING' or ${transactions.fraudPrediction} is null)::int`,
      highRisk: sql<number>`count(*) filter (where ${transactions.riskLevel} = 'HIGH')::int`,
      mediumRisk: sql<number>`count(*) filter (where ${transactions.riskLevel} = 'MEDIUM')::int`,
      lowRisk: sql<number>`count(*) filter (where ${transactions.riskLevel} = 'LOW')::int`,
      avgScore: sql<string>`coalesce(avg(${transactions.fraudScore}), 0)`,
      maxScore: sql<string>`coalesce(max(${transactions.fraudScore}), 0)`,
      minScore: sql<string>`coalesce(min(${transactions.fraudScore}), 0)`,
    })
    .from(transactions);

  // Daily series for the last 7 Dar es Salaam dates, zero-filled.
  // The timezone is inlined (not bound) so SELECT and GROUP BY render the identical expression.
  const tz = sql.raw(`'${TIMEZONE}'`);
  const dayExpr = sql<string>`to_char(${transactions.createdAt} at time zone ${tz}, 'YYYY-MM-DD')`;
  const windowStart = new Date(now.getTime() - (DAYS - 1) * 86_400_000 - 86_400_000);
  const dailyRows = await db
    .select({ date: dayExpr, total: sql<number>`count(*)::int`, fraud: fraudCount, legit: legitCount })
    .from(transactions)
    .where(gte(transactions.createdAt, windowStart))
    .groupBy(dayExpr);
  const byDate = new Map(dailyRows.map((r) => [r.date, r]));
  const daily: FraudOverview['daily'] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = darDate(new Date(now.getTime() - i * 86_400_000));
    const r = byDate.get(date);
    daily.push({ date, total: r?.total ?? 0, fraud: r?.fraud ?? 0, legit: r?.legit ?? 0 });
  }

  const byType = await db
    .select({ type: transactions.transactionType, total: sql<number>`count(*)::int`, fraud: fraudCount })
    .from(transactions)
    .where(isNotNull(transactions.fraudPrediction))
    .groupBy(transactions.transactionType)
    .orderBy(transactions.transactionType);

  const hourExpr = sql<number>`extract(hour from ${transactions.createdAt} at time zone ${tz})::int`;
  const hourRows = await db
    .select({ hour: hourExpr, total: sql<number>`count(*)::int`, fraud: fraudCount })
    .from(transactions)
    .where(isNotNull(transactions.fraudPrediction))
    .groupBy(hourExpr);
  const byHourMap = new Map(hourRows.map((r) => [r.hour, r]));
  const byHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    total: byHourMap.get(hour)?.total ?? 0,
    fraud: byHourMap.get(hour)?.fraud ?? 0,
  }));

  const suspects = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      fraudCount: sql<number>`count(${transactions.id})::int`,
      totalAmount: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(users)
    .innerJoin(transactions, eq(transactions.senderId, users.id))
    .where(eq(transactions.fraudPrediction, 'FRAUD'))
    .groupBy(users.id, users.fullName, users.email)
    .orderBy(desc(sql`count(${transactions.id})`), users.id)
    .limit(10);

  const total = stats?.total ?? 0;
  return {
    stats: {
      total,
      fraud: stats?.fraud ?? 0,
      legit: stats?.legit ?? 0,
      pending: stats?.pending ?? 0,
      highRisk: stats?.highRisk ?? 0,
      mediumRisk: stats?.mediumRisk ?? 0,
      lowRisk: stats?.lowRisk ?? 0,
      avgScore: Math.round(num(stats?.avgScore) * 10) / 10,
      maxScore: num(stats?.maxScore),
      minScore: num(stats?.minScore),
      highPct: pct(stats?.highRisk ?? 0, total),
      mediumPct: pct(stats?.mediumRisk ?? 0, total),
      lowPct: pct(stats?.lowRisk ?? 0, total),
    },
    daily,
    byType,
    byHour,
    topSuspects: suspects.map((s) => ({ ...s, totalAmount: num(s.totalAmount) })),
  };
}
