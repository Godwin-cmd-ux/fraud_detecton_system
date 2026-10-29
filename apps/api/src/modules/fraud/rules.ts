import { FRAUD } from '@fraud/shared';
import type { FraudPrediction, RiskLevel } from '@fraud/shared';
import type { VelocityContext } from './patterns';

export interface MlResult {
  riskScore: number;
  prediction: FraudPrediction;
  riskLevel: RiskLevel;
  predictionTime: Date | null;
  modelVersion: string;
}

/** What the system uses when the ML service is unavailable or errors. */
export const ML_FALLBACK: MlResult = {
  riskScore: 0,
  prediction: 'LEGIT',
  riskLevel: 'LOW',
  predictionTime: null,
  modelVersion: '1.0.0',
};

export interface RuleInput {
  amount: number;
  balance: number;
  /** Hour of day in Africa/Dar_es_Salaam. */
  hour: number;
  locationScore: number;
  ctx: VelocityContext;
}

export interface RuleOutcome {
  fraudScore: number;
  fraudPrediction: FraudPrediction;
  riskLevel: RiskLevel;
  block: boolean;
  blockReason: string | null;
}

interface Rule {
  when: (i: RuleInput) => boolean;
  score: number;
  reason: string;
}

const UNUSUAL_HOUR = 6;

const transferRules: Rule[] = [
  {
    when: (i) => i.ctx.failedWithdrawalsLast10Min >= FRAUD.FAILED_WITHDRAWAL_BLOCK_COUNT,
    score: 85,
    reason: 'Multiple failed withdrawal attempts detected',
  },
  {
    when: (i) => i.hour < UNUSUAL_HOUR && i.amount > FRAUD.LARGE_TX_THRESHOLD,
    score: 80,
    reason: 'Abnormal transaction at unusual hour with large amount',
  },
  {
    when: (i) => i.locationScore > 30 && i.amount > 500_000,
    score: 75,
    reason: 'Suspicious location change with large transaction',
  },
  {
    when: (i) => i.amount > FRAUD.EXTREME_AMOUNT,
    score: 90,
    reason: 'Transaction amount exceeds security threshold',
  },
];

const withdrawalRules: Rule[] = [
  {
    when: (i) => i.ctx.transactionCountLast5Min >= 3 && i.ctx.amountLast5Min > FRAUD.LARGE_VOLUME_MAX_SUM,
    score: 85,
    reason: 'Multiple large transactions detected in short period',
  },
  {
    when: (i) => i.hour < UNUSUAL_HOUR && i.amount > FRAUD.LARGE_TX_THRESHOLD,
    score: 85,
    reason: 'Abnormal withdrawal at unusual hour with large amount',
  },
  {
    when: (i) => i.locationScore > 30 && i.amount > 500_000,
    score: 80,
    reason: 'Suspicious location change with large withdrawal',
  },
  {
    when: (i) => i.balance > 0 && i.amount / i.balance > 0.9 && i.amount > FRAUD.LARGE_TX_THRESHOLD,
    score: 80,
    reason: 'Attempting to withdraw more than 90% of balance',
  },
  {
    when: (i) => i.amount > FRAUD.EXTREME_AMOUNT,
    score: 90,
    reason: 'Withdrawal amount exceeds security threshold',
  },
];

/** Rules override the ML result; every firing rule raises the score, and the last reason wins. */
function apply(rules: Rule[], i: RuleInput, ml: MlResult): RuleOutcome {
  let out: RuleOutcome = {
    fraudScore: ml.riskScore,
    fraudPrediction: ml.prediction,
    riskLevel: ml.riskLevel,
    block: false,
    blockReason: null,
  };
  for (const rule of rules) {
    if (rule.when(i)) {
      out = {
        fraudScore: Math.max(out.fraudScore, rule.score),
        fraudPrediction: 'FRAUD',
        riskLevel: 'HIGH',
        block: true,
        blockReason: rule.reason,
      };
    }
  }
  if (i.locationScore > 0) {
    out = { ...out, fraudScore: Math.min(out.fraudScore + i.locationScore, 100) };
  }
  return out;
}

export function applyTransferRules(i: RuleInput, ml: MlResult): RuleOutcome {
  return apply(transferRules, i, ml);
}

export function applyWithdrawalRules(i: RuleInput, ml: MlResult): RuleOutcome {
  return apply(withdrawalRules, i, ml);
}

/** A successful transaction with a score in (40, 70] shows a "flagged for review" notice. */
export function isFlaggedForReview(score: number): boolean {
  return score > FRAUD.FLAG_REVIEW_MIN_EXCLUSIVE && score <= FRAUD.FLAG_REVIEW_MAX_INCLUSIVE;
}
