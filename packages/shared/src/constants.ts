export const LOCATIONS = [
  'Dar es Salaam',
  'Mwanza',
  'Arusha',
  'Dodoma',
  'Mbeya',
  'Morogoro',
  'Tanga',
  'Moshi',
  'Zanzibar',
  'Kigoma',
] as const;
export type Location = (typeof LOCATIONS)[number];

export const DEFAULT_LOCATION: Location = 'Dar es Salaam';

export const LOCATION_COORDS: Record<Location, { lat: number; lng: number }> = {
  'Dar es Salaam': { lat: -6.7924, lng: 39.2083 },
  Mwanza: { lat: -2.5164, lng: 32.9171 },
  Arusha: { lat: -3.3869, lng: 36.6829 },
  Dodoma: { lat: -6.1629, lng: 35.7516 },
  Mbeya: { lat: -8.9067, lng: 33.4508 },
  Morogoro: { lat: -6.8225, lng: 37.6612 },
  Tanga: { lat: -5.0689, lng: 39.0966 },
  Moshi: { lat: -3.3333, lng: 37.3333 },
  Zanzibar: { lat: -6.1602, lng: 39.191 },
  Kigoma: { lat: -4.882, lng: 29.629 },
};

export const TRANSACTION_TYPES = [
  'transfer',
  'withdrawal',
  'deposit',
  'bonus',
  'refund',
  'adjustment',
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const ADJUSTMENT_TYPES = ['deposit', 'bonus', 'refund', 'adjustment'] as const;
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

export const TRANSACTION_STATUSES = ['SUCCESS', 'ABORTED', 'PENDING'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const FRAUD_PREDICTIONS = ['FRAUD', 'LEGIT', 'PENDING'] as const;
export type FraudPrediction = (typeof FRAUD_PREDICTIONS)[number];

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const ADMIN_ACTION_TYPES = [
  'add_balance',
  'approve_user',
  'disapprove_user',
  'activate_user',
  'deactivate_user',
  'delete_user',
  'reject_user',
  'create_user',
  'mark_reviewed',
] as const;
export type AdminActionType = (typeof ADMIN_ACTION_TYPES)[number];

/** Fraud thresholds, windows and scores. Values are exactly those of the original system. */
export const FRAUD = {
  LARGE_TX_THRESHOLD: 1_000_000,
  LARGE_VOLUME_MAX_COUNT: 3,
  LARGE_VOLUME_MAX_SUM: 10_000_000,
  LARGE_VOLUME_WINDOW_MIN: 5,
  MANY_RECEIVERS_WINDOW_MIN: 5,
  /** Transfer is blocked when the sender would reach this many distinct receivers. */
  MANY_RECEIVERS_BLOCK_AT: 4,
  MANY_SENDERS_WINDOW_MIN: 7,
  /** Transfer is blocked when the receiver would reach this many distinct senders. */
  MANY_SENDERS_BLOCK_AT: 3,
  FAILED_WITHDRAWALS_WINDOW_MIN: 10,
  LOCATION_WINDOW_MIN: 5,
  MIN_WITHDRAWAL: 1_000,
  MAX_ADMIN_ADJUSTMENT: 10_000_000,
  EXTREME_AMOUNT: 10_000_000,
  LOGIN_MAX_FAILURES: 3,
  LOGIN_LOCKOUT_MIN: 5,
  FAILED_WITHDRAWAL_BLOCK_COUNT: 3,
  FAILED_WITHDRAWAL_RESET_HOURS: 24,
  RESET_TOKEN_TTL_MIN: 5,
  TRANSACTIONS_UNLOCK_TTL_MIN: 5,
  BALANCE_REVEAL_TTL_MIN: 5,
  FLAG_REVIEW_MIN_EXCLUSIVE: 40,
  FLAG_REVIEW_MAX_INCLUSIVE: 70,
  ALERT_MIN_SCORE_EXCLUSIVE: 50,
} as const;

export const PAGE_SIZES = { USER_TRANSACTIONS: 15, ADMIN: 20 } as const;

export const TIMEZONE = 'Africa/Dar_es_Salaam';
