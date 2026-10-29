import { and, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { FRAUD } from '@fraud/shared';
import type { FraudAlertsQuery, Paginated } from '@fraud/shared';
import type { Db } from '../../db/client';
import { transactions } from '../../db/schema';
import { dateRange, partySearch, queryTransactions } from './transactions';
import type { AdminTxRow } from './transactions';

/** FRAUD predictions scoring above 50 are alerts. */
export const alertBase: SQL = and(
  eq(transactions.fraudPrediction, 'FRAUD'),
  gt(transactions.fraudScore, sql`${FRAUD.ALERT_MIN_SCORE_EXCLUSIVE}`),
)!;

export async function listFraudAlerts(db: Db, q: FraudAlertsQuery): Promise<Paginated<AdminTxRow>> {
  const where = and(
    alertBase,
    partySearch(q.search),
    q.riskLevel ? eq(transactions.riskLevel, q.riskLevel) : undefined,
    dateRange(q.dateFrom, q.dateTo),
    q.reviewed === 'unreviewed'
      ? isNull(transactions.reviewedAt)
      : q.reviewed === 'reviewed'
        ? isNotNull(transactions.reviewedAt)
        : undefined,
  );
  return queryTransactions(db, where, q.page);
}
