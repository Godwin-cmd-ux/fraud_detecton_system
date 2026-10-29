import { describe, expect, it } from 'vitest';
import {
  ML_FALLBACK,
  applyTransferRules,
  applyWithdrawalRules,
  isFlaggedForReview,
} from '../../src/modules/fraud/rules';
import type { MlResult, RuleInput } from '../../src/modules/fraud/rules';
import type { VelocityContext } from '../../src/modules/fraud/patterns';

const ctx: VelocityContext = {
  transactionCountLast5Min: 0,
  amountLast5Min: 0,
  largeCountLast5Min: 0,
  largeSumLast5Min: 0,
  uniqueReceiversLast5Min: 0,
  receiverAlreadyInWindow: false,
  uniqueSendersToReceiverLast7Min: 0,
  senderAlreadyInReceiverWindow: false,
  uniqueSendersLast5Min: 0,
  failedWithdrawalsLast10Min: 0,
  avgUserAmount: 0,
};

const ml = (riskScore: number, prediction: MlResult['prediction'] = 'LEGIT', riskLevel: MlResult['riskLevel'] = 'LOW'): MlResult => ({
  riskScore,
  prediction,
  riskLevel,
  predictionTime: new Date('2026-10-29T10:00:00Z'),
  modelVersion: '1.0.0',
});

const input = (over: Partial<RuleInput> = {}): RuleInput => ({
  amount: 100_000,
  balance: 5_000_000,
  hour: 12,
  locationScore: 0,
  ctx,
  ...over,
});

describe('applyTransferRules', () => {
  it('keeps the ML score when no rule fires', () => {
    expect(applyTransferRules(input(), ml(20))).toEqual({
      fraudScore: 20,
      fraudPrediction: 'LEGIT',
      riskLevel: 'LOW',
      block: false,
      blockReason: null,
    });
  });

  it('blocks on three recent failed withdrawals', () => {
    const r = applyTransferRules(input({ ctx: { ...ctx, failedWithdrawalsLast10Min: 3 } }), ML_FALLBACK);
    expect(r).toMatchObject({ fraudScore: 85, fraudPrediction: 'FRAUD', riskLevel: 'HIGH', block: true, blockReason: 'Multiple failed withdrawal attempts detected' });
  });

  it('blocks large amounts before 06:00 but not at 06:00', () => {
    expect(applyTransferRules(input({ hour: 5, amount: 1_000_001 }), ML_FALLBACK)).toMatchObject({
      fraudScore: 80,
      block: true,
      blockReason: 'Abnormal transaction at unusual hour with large amount',
    });
    expect(applyTransferRules(input({ hour: 6, amount: 1_000_001 }), ML_FALLBACK).block).toBe(false);
  });

  it('blocks a far location change with a large amount and adds the location score', () => {
    const r = applyTransferRules(input({ locationScore: 40, amount: 500_001 }), ML_FALLBACK);
    expect(r).toMatchObject({ block: true, blockReason: 'Suspicious location change with large transaction', fraudScore: 100 });
  });

  it('adds a small location score without blocking', () => {
    const r = applyTransferRules(input({ locationScore: 25, amount: 500_001 }), ml(10));
    expect(r).toMatchObject({ block: false, fraudScore: 35 });
  });

  it('blocks extreme amounts and the last reason wins', () => {
    expect(applyTransferRules(input({ amount: 10_000_001 }), ML_FALLBACK)).toMatchObject({
      fraudScore: 90,
      blockReason: 'Transaction amount exceeds security threshold',
    });
    expect(applyTransferRules(input({ hour: 5, amount: 20_000_000 }), ML_FALLBACK)).toMatchObject({
      fraudScore: 90,
      blockReason: 'Transaction amount exceeds security threshold',
    });
  });

  it('never blocks on the ML score alone', () => {
    expect(applyTransferRules(input(), ml(95, 'FRAUD', 'HIGH'))).toMatchObject({ fraudScore: 95, block: false, fraudPrediction: 'FRAUD', riskLevel: 'HIGH' });
  });
});

describe('applyWithdrawalRules', () => {
  it('blocks multiple large transactions in a short period', () => {
    const r = applyWithdrawalRules(input({ amount: 50_000, ctx: { ...ctx, transactionCountLast5Min: 3, amountLast5Min: 10_000_001 } }), ML_FALLBACK);
    expect(r).toMatchObject({ fraudScore: 85, block: true, blockReason: 'Multiple large transactions detected in short period' });
  });

  it('blocks large withdrawals at unusual hours', () => {
    expect(applyWithdrawalRules(input({ hour: 3, amount: 1_000_001 }), ML_FALLBACK)).toMatchObject({ fraudScore: 85, blockReason: 'Abnormal withdrawal at unusual hour with large amount' });
  });

  it('blocks a far location change with a large withdrawal', () => {
    expect(applyWithdrawalRules(input({ locationScore: 40, amount: 600_000 }), ML_FALLBACK)).toMatchObject({ fraudScore: 100, blockReason: 'Suspicious location change with large withdrawal' });
  });

  it('blocks withdrawing more than 90% of the balance when the amount is large', () => {
    expect(applyWithdrawalRules(input({ amount: 1_000_001, balance: 1_100_000 }), ML_FALLBACK)).toMatchObject({ fraudScore: 80, blockReason: 'Attempting to withdraw more than 90% of balance' });
    expect(applyWithdrawalRules(input({ amount: 900_000, balance: 1_000_000 }), ML_FALLBACK).block).toBe(false);
  });

  it('blocks extreme withdrawals', () => {
    expect(applyWithdrawalRules(input({ amount: 10_000_001, balance: 20_000_000 }), ML_FALLBACK)).toMatchObject({ fraudScore: 90, blockReason: 'Withdrawal amount exceeds security threshold' });
  });
});

describe('isFlaggedForReview', () => {
  it('flags scores strictly above 40 and up to 70', () => {
    expect(isFlaggedForReview(40)).toBe(false);
    expect(isFlaggedForReview(41)).toBe(true);
    expect(isFlaggedForReview(70)).toBe(true);
    expect(isFlaggedForReview(71)).toBe(false);
  });
});
