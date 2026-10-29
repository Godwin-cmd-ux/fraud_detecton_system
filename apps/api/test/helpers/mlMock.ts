import { MlClient } from '../../src/modules/fraud/mlClient';
import type { MlResult } from '../../src/modules/fraud/rules';

/**
 * An MlClient whose HTTP layer is replaced by a fake fetch.
 * 'down' makes /health fail; a result makes /predict return it. Calls are recorded.
 */
export function mlMock(result: MlResult | 'down'): MlClient & { calls: string[] } {
  const calls: string[] = [];
  const fakeFetch: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (result === 'down') throw new Error('ECONNREFUSED');
    if (url.endsWith('/health')) {
      return new Response(JSON.stringify({ status: 'healthy', model_loaded: true }), { status: 200 });
    }
    if (url.endsWith('/predict')) {
      return new Response(
        JSON.stringify({
          status: 'success',
          prediction: result.prediction,
          risk_score: result.riskScore,
          risk_level: result.riskLevel,
          prediction_time: result.predictionTime?.toISOString() ?? null,
          model_version: result.modelVersion,
        }),
        { status: 200 },
      );
    }
    return new Response('not found', { status: 404 });
  };
  const client = new MlClient('http://ml.test', fakeFetch) as MlClient & { calls: string[] };
  client.calls = calls;
  return client;
}
