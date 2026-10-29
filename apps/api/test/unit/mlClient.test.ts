import { describe, expect, it } from 'vitest';
import { MlClient, scoreWithMl } from '../../src/modules/fraud/mlClient';
import { ML_FALLBACK } from '../../src/modules/fraud/rules';
import type { MlFeatures } from '../../src/modules/fraud/features';

const features: MlFeatures = {
  amount: 150_000,
  transaction_count_last_5min: 1,
  amount_last_5min: 150_000,
  unique_receivers_last_5min: 1,
  unique_senders_last_5min: 1,
  failed_withdrawals_last_10min: 0,
  transaction_hour: 14,
  avg_user_amount: 50_000,
  amount_deviation: 2,
  account_age_days: 365,
  balance: 500_000,
};

type Handler = (url: string, init?: RequestInit) => Promise<Response> | Response;
const fakeFetch = (handler: Handler): typeof fetch =>
  (async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init)) as typeof fetch;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('MlClient.isAvailable', () => {
  it('is true when /health answers 200', async () => {
    const ml = new MlClient('http://ml', fakeFetch(() => json({ status: 'healthy' })));
    expect(await ml.isAvailable()).toBe(true);
  });

  it('is false when the request throws', async () => {
    const ml = new MlClient('http://ml', fakeFetch(() => { throw new Error('ECONNREFUSED'); }));
    expect(await ml.isAvailable()).toBe(false);
  });
});

describe('MlClient.predict', () => {
  it('maps a successful prediction', async () => {
    const ml = new MlClient(
      'http://ml',
      fakeFetch((url, init) => {
        expect(url).toBe('http://ml/predict');
        expect(JSON.parse(String(init?.body))).toEqual(features);
        return json({
          status: 'success',
          risk_score: 72,
          prediction: 'FRAUD',
          risk_level: 'HIGH',
          prediction_time: '2026-10-29T10:00:00',
          model_version: '1.0.0',
        });
      }),
    );
    const r = await ml.predict(features);
    expect(r).toMatchObject({ riskScore: 72, prediction: 'FRAUD', riskLevel: 'HIGH', modelVersion: '1.0.0' });
    expect(r!.predictionTime).toBeInstanceOf(Date);
  });

  it('returns null on a non-200 response', async () => {
    const ml = new MlClient('http://ml', fakeFetch(() => json({ error: 'boom' }, 500)));
    expect(await ml.predict(features)).toBeNull();
  });

  it('returns null when status is not success', async () => {
    const ml = new MlClient('http://ml', fakeFetch(() => json({ status: 'error' })));
    expect(await ml.predict(features)).toBeNull();
  });

  it('gives up after the timeout', async () => {
    const never: typeof fetch = ((_: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as typeof fetch;
    const ml = new MlClient('http://ml', never, { health: 10, predict: 10 });
    const started = Date.now();
    expect(await ml.predict(features)).toBeNull();
    expect(Date.now() - started).toBeLessThan(100);
  });
});

describe('scoreWithMl', () => {
  it('falls back when the service is down', async () => {
    const ml = new MlClient('http://ml', fakeFetch(() => { throw new Error('down'); }));
    expect(await scoreWithMl(ml, features)).toEqual({ result: ML_FALLBACK, used: false });
  });

  it('uses the prediction when the service is up', async () => {
    const ml = new MlClient(
      'http://ml',
      fakeFetch((url) =>
        url.endsWith('/health')
          ? json({ status: 'healthy' })
          : json({ status: 'success', risk_score: 33, prediction: 'LEGIT', risk_level: 'MEDIUM', model_version: '1.0.0' }),
      ),
    );
    const r = await scoreWithMl(ml, features);
    expect(r.used).toBe(true);
    expect(r.result.riskScore).toBe(33);
  });
});
