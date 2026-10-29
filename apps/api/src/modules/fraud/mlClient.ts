import { FRAUD_PREDICTIONS, RISK_LEVELS } from '@fraud/shared';
import type { FraudPrediction, RiskLevel } from '@fraud/shared';
import type { MlFeatures } from './features';
import { ML_FALLBACK } from './rules';
import type { MlResult } from './rules';

export interface MlTimeouts {
  health: number;
  predict: number;
}

/** HTTP client for the Python scoring service. Every failure degrades to `null`. */
export class MlClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeouts: MlTimeouts = { health: 3000, predict: 5000 },
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeouts.health),
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  async predict(features: MlFeatures): Promise<MlResult | null> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(features),
        signal: AbortSignal.timeout(this.timeouts.predict),
      });
      if (res.status !== 200) return null;
      const data = (await res.json()) as Record<string, unknown>;
      if (data.status !== 'success') return null;
      return parseResult(data);
    } catch {
      return null;
    }
  }

  async modelInfo(): Promise<unknown | null> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/model_info`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeouts.health),
      });
      if (res.status !== 200) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
}

function parseResult(data: Record<string, unknown>): MlResult {
  const prediction = FRAUD_PREDICTIONS.includes(data.prediction as FraudPrediction)
    ? (data.prediction as FraudPrediction)
    : ML_FALLBACK.prediction;
  const riskLevel = RISK_LEVELS.includes(data.risk_level as RiskLevel)
    ? (data.risk_level as RiskLevel)
    : ML_FALLBACK.riskLevel;
  const riskScore = typeof data.risk_score === 'number' ? data.risk_score : 0;
  const predictionTime =
    typeof data.prediction_time === 'string' && !Number.isNaN(Date.parse(data.prediction_time))
      ? new Date(data.prediction_time)
      : null;
  const modelVersion =
    typeof data.model_version === 'string' ? data.model_version : ML_FALLBACK.modelVersion;
  return { riskScore, prediction, riskLevel, predictionTime, modelVersion };
}

/** Health-check then predict; anything that fails yields the fallback and `used: false`. */
export async function scoreWithMl(
  ml: MlClient,
  features: MlFeatures,
): Promise<{ result: MlResult; used: boolean }> {
  if (!(await ml.isAvailable())) return { result: ML_FALLBACK, used: false };
  const result = await ml.predict(features);
  if (!result) return { result: ML_FALLBACK, used: false };
  return { result, used: true };
}
