import { describe, expect, it } from 'vitest';
import { buildFeatures } from '../../src/modules/fraud/features';
import type { VelocityContext } from '../../src/modules/fraud/patterns';

const ctx: VelocityContext = {
  transactionCountLast5Min: 2,
  amountLast5Min: 300_000,
  largeCountLast5Min: 0,
  largeSumLast5Min: 0,
  uniqueReceiversLast5Min: 1,
  receiverAlreadyInWindow: false,
  uniqueSendersToReceiverLast7Min: 0,
  senderAlreadyInReceiverWindow: false,
  uniqueSendersLast5Min: 1,
  failedWithdrawalsLast10Min: 0,
  avgUserAmount: 50_000,
};

describe('buildFeatures', () => {
  const now = new Date('2026-10-29T12:00:00Z');

  it('maps the context into the 11 model features', () => {
    const f = buildFeatures({
      amount: 150_000,
      hour: 15,
      balance: 500_000,
      accountCreatedAt: new Date('2026-10-19T12:00:00Z'),
      now,
      ctx,
    });
    expect(f).toEqual({
      amount: 150_000,
      transaction_count_last_5min: 2,
      amount_last_5min: 300_000,
      unique_receivers_last_5min: 1,
      unique_senders_last_5min: 1,
      failed_withdrawals_last_10min: 0,
      transaction_hour: 15,
      avg_user_amount: 50_000,
      amount_deviation: (150_000 - 50_000) / 50_001,
      account_age_days: 10,
      balance: 500_000,
    });
  });

  it('uses zero deviation when the user has no average', () => {
    const f = buildFeatures({ amount: 100, hour: 1, balance: 0, accountCreatedAt: now, now, ctx: { ...ctx, avgUserAmount: 0 } });
    expect(f.amount_deviation).toBe(0);
    expect(f.account_age_days).toBe(0);
  });
});
