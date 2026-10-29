import type { FraudPrediction, RiskLevel } from '@fraud/shared';

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
