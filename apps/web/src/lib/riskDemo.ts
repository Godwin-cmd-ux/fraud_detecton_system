import { FRAUD, LOCATION_COORDS } from '@fraud/shared';
import type { Location } from '@fraud/shared';

/**
 * Client-side mirror of the transfer checks in apps/api/src/modules/fraud
 * (patterns.ts, location.ts, rules.ts) for the landing-page demo. The live
 * system also adds the ML model's score; the demo leaves that at zero.
 */
export interface DemoInput {
  amount: number;
  /** Hour of day, 0-23, Africa/Dar_es_Salaam. */
  hour: number;
  previousLocation: Location;
  currentLocation: Location;
  /** Distinct people this sender paid in the last 5 minutes (this transfer goes to someone new). */
  recentRecipients: number;
  /** Distinct people who paid this recipient in the last 7 minutes (this sender is new to them). */
  recipientSenders: number;
  /** Failed withdrawal attempts in the last 10 minutes. */
  failedWithdrawals: number;
}

export type DemoVerdict = 'cleared' | 'review' | 'blocked';

export interface DemoSignal {
  label: string;
  /** Score this signal contributes or sets; `blocks` signals stop the transfer. */
  points: number;
  blocks: boolean;
}

export interface DemoResult {
  score: number;
  verdict: DemoVerdict;
  signals: DemoSignal[];
  distanceKm: number;
}

/** Same rule the backend uses for night-time transfers. */
const UNUSUAL_HOUR = 6;
const EARTH_RADIUS_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function distanceKm(a: Location, b: Location): number {
  const p = LOCATION_COORDS[a];
  const q = LOCATION_COORDS[b];
  const dLat = rad(q.lat - p.lat);
  const dLng = rad(q.lng - p.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(p.lat)) * Math.cos(rad(q.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

/** +10 for any change of city, plus 50 / 30 / 15 for distances over 500 / 200 / 50 km. */
function locationPoints(distance: number, changed: boolean): number {
  if (!changed) return 0;
  return 10 + (distance > 500 ? 50 : distance > 200 ? 30 : distance > 50 ? 15 : 0);
}

export function simulateTransfer(input: DemoInput): DemoResult {
  const changed = input.previousLocation !== input.currentLocation;
  const distance = changed ? distanceKm(input.previousLocation, input.currentLocation) : 0;

  // 1. Velocity patterns: the first one that matches blocks the transfer outright.
  if (input.recentRecipients + 1 >= FRAUD.MANY_RECEIVERS_BLOCK_AT) {
    return {
      score: 90,
      verdict: 'blocked',
      distanceKm: distance,
      signals: [{ label: 'Too many recipients in 5 minutes', points: 90, blocks: true }],
    };
  }
  if (input.recipientSenders + 1 >= FRAUD.MANY_SENDERS_BLOCK_AT) {
    return {
      score: 90,
      verdict: 'blocked',
      distanceKm: distance,
      signals: [{ label: 'Recipient is collecting from many senders', points: 90, blocks: true }],
    };
  }

  // 2. Rules: each match blocks and raises the score to at least its value.
  const location = locationPoints(distance, changed);
  const rules: [boolean, number, string][] = [
    [
      input.failedWithdrawals >= FRAUD.FAILED_WITHDRAWAL_BLOCK_COUNT,
      85,
      'Repeated failed withdrawals',
    ],
    [
      input.hour < UNUSUAL_HOUR && input.amount > FRAUD.LARGE_TX_THRESHOLD,
      80,
      'Large amount at an unusual hour',
    ],
    [location > 30 && input.amount > 500_000, 75, 'Location jump with a large amount'],
    [input.amount > FRAUD.EXTREME_AMOUNT, 90, 'Amount above the security limit'],
  ];
  const signals: DemoSignal[] = [];
  let score = 0;
  for (const [fired, points, label] of rules) {
    if (!fired) continue;
    score = Math.max(score, points);
    signals.push({ label, points, blocks: true });
  }

  // 3. A change of city always adds its points on top, capped at 100.
  if (location > 0) {
    score = Math.min(score + location, 100);
    signals.push({ label: 'Sent from a different city', points: location, blocks: false });
  }

  const blocked = signals.some((s) => s.blocks);
  const verdict: DemoVerdict = blocked
    ? 'blocked'
    : score > FRAUD.FLAG_REVIEW_MIN_EXCLUSIVE && score <= FRAUD.FLAG_REVIEW_MAX_INCLUSIVE
      ? 'review'
      : 'cleared';
  return { score, verdict, signals, distanceKm: distance };
}
