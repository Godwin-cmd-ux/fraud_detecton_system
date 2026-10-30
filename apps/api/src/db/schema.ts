import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  json,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  ADMIN_ACTION_TYPES,
  FRAUD_PREDICTIONS,
  RISK_LEVELS,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
} from '@fraud/shared';

export const transactionTypeEnum = pgEnum('transaction_type', TRANSACTION_TYPES);
export const transactionStatusEnum = pgEnum('transaction_status', TRANSACTION_STATUSES);
export const fraudPredictionEnum = pgEnum('fraud_prediction', FRAUD_PREDICTIONS);
export const riskLevelEnum = pgEnum('risk_level', RISK_LEVELS);
export const adminActionTypeEnum = pgEnum('admin_action_type', ADMIN_ACTION_TYPES);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    fullName: varchar('full_name', { length: 100 }).notNull(),
    email: varchar('email', { length: 100 }).notNull().unique(),
    phone: varchar('phone', { length: 20 }).notNull().unique(),
    cardNumber: varchar('card_number', { length: 20 }).notNull().unique(),
    /** Virtual card issued by the system: MM/YY, three years out. */
    cardExpiry: varchar('card_expiry', { length: 5 }),
    cardCvc: varchar('card_cvc', { length: 3 }),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    balance: numeric('balance', { precision: 15, scale: 2 }).notNull().default('0'),
    securityAnswers: jsonb('security_answers').$type<Record<string, string>>(),
    isApproved: boolean('is_approved').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    resetToken: varchar('reset_token', { length: 64 }),
    resetTokenExpiry: timestamp('reset_token_expiry', { withTimezone: true }),
    lastKnownLocation: varchar('last_known_location', { length: 100 }),
    /** Last raw reading from the browser, kept next to the resolved city. */
    lastLat: numeric('last_lat', { precision: 9, scale: 6 }),
    lastLng: numeric('last_lng', { precision: 9, scale: 6 }),
    locationUpdatedAt: timestamp('location_updated_at', { withTimezone: true }),
    /** USSD transaction PIN (bcrypt). Null until the customer enrols one through USSD. */
    transactionPinHash: varchar('transaction_pin_hash', { length: 255 }),
    pinAttempts: integer('pin_attempts').notNull().default(0),
    pinLockedUntil: timestamp('pin_locked_until', { withTimezone: true }),
    ...timestamps,
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('users_balance_non_negative', sql`${t.balance} >= 0`),
    index('users_reset_token_idx').on(t.resetToken),
  ],
);

export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 100 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  lastLogin: timestamp('last_login', { withTimezone: true }),
  /** Number the USSD gateway recognises as this administrator (unique when set). */
  phone: varchar('phone', { length: 20 }),
  pinHash: varchar('pin_hash', { length: 255 }),
  pinAttempts: integer('pin_attempts').notNull().default(0),
  pinLockedUntil: timestamp('pin_locked_until', { withTimezone: true }),
  ...timestamps,
});

export const transactions = pgTable(
  'transactions',
  {
    id: serial('id').primaryKey(),
    transactionId: varchar('transaction_id', { length: 50 }).notNull().unique(),
    senderId: integer('sender_id').references(() => users.id, { onDelete: 'set null' }),
    receiverId: integer('receiver_id').references(() => users.id, { onDelete: 'set null' }),
    senderName: varchar('sender_name', { length: 100 }),
    receiverName: varchar('receiver_name', { length: 100 }),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    /** Revenue earned on this movement; only SUCCESS rows count towards it. */
    fee: numeric('fee', { precision: 15, scale: 2 }).notNull().default('0'),
    transactionType: transactionTypeEnum('transaction_type').notNull(),
    status: transactionStatusEnum('status').notNull(),
    message: text('message'),
    fraudScore: numeric('fraud_score', { precision: 5, scale: 2 }).notNull().default('0'),
    fraudPrediction: fraudPredictionEnum('fraud_prediction'),
    riskLevel: riskLevelEnum('risk_level'),
    predictionTime: timestamp('prediction_time', { withTimezone: true }),
    modelVersion: varchar('model_version', { length: 20 }),
    featureData: jsonb('feature_data').$type<Record<string, unknown>>(),
    transactionLocation: varchar('transaction_location', { length: 100 }),
    txLat: numeric('tx_lat', { precision: 9, scale: 6 }),
    txLng: numeric('tx_lng', { precision: 9, scale: 6 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    adminId: integer('admin_id').references(() => admins.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: integer('reviewed_by').references(() => admins.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('transactions_sender_created_idx').on(t.senderId, t.createdAt),
    index('transactions_receiver_created_idx').on(t.receiverId, t.createdAt),
    index('transactions_status_idx').on(t.status),
    index('transactions_fraud_idx').on(t.fraudPrediction, t.fraudScore),
    index('transactions_risk_idx').on(t.riskLevel),
    index('transactions_type_idx').on(t.transactionType),
    index('transactions_created_idx').on(t.createdAt),
  ],
);

export const adminActions = pgTable('admin_actions', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id')
    .notNull()
    .references(() => admins.id, { onDelete: 'cascade' }),
  adminName: varchar('admin_name', { length: 100 }).notNull(),
  actionType: adminActionTypeEnum('action_type').notNull(),
  userId: integer('user_id'),
  userName: varchar('user_name', { length: 100 }),
  amount: numeric('amount', { precision: 15, scale: 2 }),
  reason: text('reason'),
  details: text('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  ...timestamps,
});

export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id'),
    email: varchar('email', { length: 100 }).notNull(),
    ipAddress: varchar('ip_address', { length: 45 }).notNull(),
    attemptCount: integer('attempt_count').notNull().default(1),
    lockoutUntil: timestamp('lockout_until', { withTimezone: true }),
    ...timestamps,
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('login_attempts_email_ip_idx').on(t.email, t.ipAddress),
    index('login_attempts_lockout_idx').on(t.lockoutUntil),
  ],
);

export const failedLoginLog = pgTable(
  'failed_login_log',
  {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 100 }).notNull(),
    ipAddress: varchar('ip_address', { length: 45 }).notNull(),
    userId: integer('user_id'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('failed_login_log_email_idx').on(t.email)],
);

export const failedWithdrawalAttempts = pgTable('failed_withdrawal_attempts', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  attemptCount: integer('attempt_count').notNull().default(0),
  lastAttemptTime: timestamp('last_attempt_time', { withTimezone: true }),
});

export const securityQuestions = pgTable('security_questions', {
  id: serial('id').primaryKey(),
  questionKey: varchar('question_key', { length: 50 }).notNull().unique(),
  questionText: varchar('question_text', { length: 255 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
});

/**
 * USSD session state. `state` is the navigation/multi-step state machine (scene + collected
 * inputs), persisted so the callback stays stateless between HTTP requests and survives restarts.
 */
export const ussdSessions = pgTable(
  'ussd_sessions',
  {
    id: varchar('id', { length: 128 }).primaryKey(),
    phone: varchar('phone', { length: 20 }).notNull(),
    actorKind: varchar('actor_kind', { length: 10 }),
    actorId: integer('actor_id'),
    state: jsonb('state').$type<Record<string, unknown>>().notNull(),
    /** The cumulative gateway `text` already consumed; the continuity anchor for the next screen. */
    lastText: text('last_text').notNull(),
    ...timestamps,
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('ussd_sessions_phone_idx').on(t.phone),
    index('ussd_sessions_expires_idx').on(t.expiresAt),
  ],
);

/**
 * One row per gateway callback, also the idempotency ledger: a repeated delivery of the same
 * (session, text) returns the stored response instead of re-running the workflow a second time.
 */
export const ussdRequests = pgTable(
  'ussd_requests',
  {
    id: serial('id').primaryKey(),
    sessionId: varchar('session_id', { length: 128 }).notNull(),
    phone: varchar('phone', { length: 20 }).notNull(),
    textHash: varchar('text_hash', { length: 64 }).notNull(),
    /** Cumulative input with PIN segments masked, so secrets never reach the database. */
    text: text('text').notNull(),
    response: text('response').notNull(),
    isEnd: boolean('is_end').notNull().default(false),
    scene: varchar('scene', { length: 40 }),
    actorKind: varchar('actor_kind', { length: 10 }),
    actorId: integer('actor_id'),
    ipAddress: varchar('ip_address', { length: 45 }),
    durationMs: integer('duration_ms'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('ussd_requests_session_text_uq').on(t.sessionId, t.textHash),
    index('ussd_requests_created_idx').on(t.createdAt),
    index('ussd_requests_phone_idx').on(t.phone, t.createdAt),
  ],
);

/** Rejected callbacks, PIN lockouts and privilege violations, kept for administrator review. */
export const ussdSecurityEvents = pgTable(
  'ussd_security_events',
  {
    id: serial('id').primaryKey(),
    eventType: varchar('event_type', { length: 40 }).notNull(),
    phone: varchar('phone', { length: 20 }),
    sessionId: varchar('session_id', { length: 128 }),
    detail: text('detail'),
    ipAddress: varchar('ip_address', { length: 45 }),
    ...timestamps,
  },
  (t) => [index('ussd_security_events_type_idx').on(t.eventType, t.createdAt)],
);

/** Session store table for connect-pg-simple. */
export const sessions = pgTable(
  'sessions',
  {
    sid: varchar('sid').primaryKey(),
    sess: json('sess').notNull(),
    expire: timestamp('expire', { precision: 6, withTimezone: false }).notNull(),
  },
  (t) => [index('sessions_expire_idx').on(t.expire)],
);
