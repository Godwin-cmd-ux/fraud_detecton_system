import { daysBetween } from '../../lib/time';
import type { VelocityContext } from './patterns';

/** The 11 features the XGBoost model was trained on, in the service's snake_case names. */
export interface MlFeatures {
  amount: number;
  transaction_count_last_5min: number;
  amount_last_5min: number;
  unique_receivers_last_5min: number;
  unique_senders_last_5min: number;
  failed_withdrawals_last_10min: number;
  transaction_hour: number;
  avg_user_amount: number;
  amount_deviation: number;
  account_age_days: number;
  balance: number;
}

export interface FeatureArgs {
  amount: number;
  hour: number;
  balance: number;
  accountCreatedAt: Date;
  now: Date;
  ctx: VelocityContext;
}

export function buildFeatures(a: FeatureArgs): MlFeatures {
  const avg = a.ctx.avgUserAmount;
  return {
    amount: a.amount,
    transaction_count_last_5min: a.ctx.transactionCountLast5Min,
    amount_last_5min: a.ctx.amountLast5Min,
    unique_receivers_last_5min: a.ctx.uniqueReceiversLast5Min,
    unique_senders_last_5min: a.ctx.uniqueSendersLast5Min,
    failed_withdrawals_last_10min: a.ctx.failedWithdrawalsLast10Min,
    transaction_hour: a.hour,
    avg_user_amount: avg,
    amount_deviation: avg === 0 ? 0 : (a.amount - avg) / (avg + 1),
    account_age_days: daysBetween(a.accountCreatedAt, a.now),
    balance: a.balance,
  };
}
