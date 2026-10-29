import { describe, expect, it } from 'vitest';
import { distanceKm, locationScore, locationWarning } from '../../src/modules/fraud/location';

describe('distanceKm', () => {
  it('computes haversine distance between known cities', () => {
    const d = distanceKm('Dar es Salaam', 'Mwanza');
    expect(Math.abs(d - 843)).toBeLessThanOrEqual(5);
    expect(distanceKm('Arusha', 'Arusha')).toBe(0);
  });
});

describe('locationScore', () => {
  const change = (distance: number) => ({
    changed: true as const,
    previousLocation: 'Dar es Salaam' as const,
    newLocation: 'Mwanza' as const,
    distanceKm: distance,
    timeElapsedMinutes: 5,
  });

  it('is zero when the location did not change', () => {
    expect(locationScore({ changed: false, newLocation: 'Mwanza', timeElapsedMinutes: 5 })).toBe(0);
  });

  it('adds 10 plus distance points', () => {
    expect(locationScore(change(30))).toBe(10);
    expect(locationScore(change(100))).toBe(25);
    expect(locationScore(change(300))).toBe(40);
    expect(locationScore(change(600))).toBe(60);
  });

  it('describes the change for the user', () => {
    expect(locationWarning(change(843))).toBe(
      '⚠️ Location changed from Dar es Salaam to Mwanza (843 km away) in 5 minutes',
    );
    expect(
      locationWarning({ changed: false, newLocation: 'Mwanza', timeElapsedMinutes: 5 }),
    ).toBeUndefined();
  });
});
