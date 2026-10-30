import { describe, expect, it } from 'vitest';
import { distanceKm, simulateTransfer } from './riskDemo';
import type { DemoInput } from './riskDemo';

const base: DemoInput = {
  amount: 125_000,
  hour: 14,
  previousLocation: 'Dar es Salaam',
  currentLocation: 'Dar es Salaam',
  recentRecipients: 0,
  recipientSenders: 0,
  failedWithdrawals: 0,
};
const run = (patch: Partial<DemoInput>) => simulateTransfer({ ...base, ...patch });

describe('simulateTransfer mirrors the backend transfer checks', () => {
  it('clears an ordinary daytime payment', () => {
    expect(run({})).toMatchObject({ score: 0, verdict: 'cleared', signals: [] });
  });
  it('matches the backend great-circle distance', () => {
    // Values returned by distanceKm in apps/api/src/modules/fraud/location.ts.
    expect(distanceKm('Dar es Salaam', 'Mwanza')).toBe(844);
    expect(distanceKm('Dar es Salaam', 'Zanzibar')).toBe(70);
    expect(distanceKm('Arusha', 'Moshi')).toBe(72);
  });
  it('flags a small transfer after a long city jump for review', () => {
    expect(run({ currentLocation: 'Mwanza' })).toMatchObject({ score: 60, verdict: 'review' });
  });
  it('clears a short hop between nearby cities', () => {
    expect(run({ currentLocation: 'Zanzibar' })).toMatchObject({ score: 25, verdict: 'cleared' });
  });
  it('blocks a large transfer after a long city jump and caps the score', () => {
    const r = run({ currentLocation: 'Mwanza', amount: 2_500_000 });
    expect(r).toMatchObject({ score: 100, verdict: 'blocked' });
  });
  it('blocks large night-time transfers', () => {
    expect(run({ hour: 2, amount: 2_500_000 })).toMatchObject({ score: 80, verdict: 'blocked' });
    expect(run({ hour: 2, amount: 900_000 }).verdict).toBe('cleared');
  });
  it('blocks the fourth recipient in five minutes and a third sender to one recipient', () => {
    expect(run({ recentRecipients: 3 })).toMatchObject({ score: 90, verdict: 'blocked' });
    expect(run({ recentRecipients: 2 }).verdict).toBe('cleared');
    expect(run({ recipientSenders: 2 })).toMatchObject({ score: 90, verdict: 'blocked' });
  });
  it('blocks after repeated failed withdrawals and above the amount limit', () => {
    expect(run({ failedWithdrawals: 3 })).toMatchObject({ score: 85, verdict: 'blocked' });
    expect(run({ amount: 12_000_000 })).toMatchObject({ score: 90, verdict: 'blocked' });
  });
});
