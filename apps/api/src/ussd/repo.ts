import { createHash } from 'node:crypto';
import { and, desc, eq, gt, gte, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { admins, ussdRequests, ussdSecurityEvents, ussdSessions, users } from '../db/schema';
import type { Actor, UssdState } from './machine';
import { phoneDigits } from './phone';

export type UserRow = typeof users.$inferSelect;
export type AdminRow = typeof admins.$inferSelect;
export type SessionRow = typeof ussdSessions.$inferSelect;

/**
 * Both tables may hold numbers in any of the formats the two interfaces accept, so comparison is
 * done on digits only. A single customer therefore resolves to exactly one account.
 */
const phoneDigitsOf = (column: typeof users.phone | typeof admins.phone) =>
  sql`replace(replace(${column}, ' ', ''), '+', '')`;

export interface ResolvedActor {
  actor: Actor | null;
  user: UserRow | null;
  admin: AdminRow | null;
}

/**
 * Identifies the caller from the number the gateway reports. Administrators are matched first: an
 * admin phone bound in `admins.phone` always opens the administrative dashboard. The rows are
 * returned as-is so the caller can explain a disabled or unapproved account instead of silently
 * treating it as an unknown number.
 */
export async function resolveActor(db: Db, phone: string): Promise<ResolvedActor> {
  const digits = phoneDigits(phone);

  const [admin] = await db
    .select()
    .from(admins)
    .where(sql`${phoneDigitsOf(admins.phone)} = ${digits}`)
    .limit(1);
  if (admin) {
    return {
      actor: admin.isActive ? { kind: 'admin', id: admin.id, name: admin.fullName } : null,
      user: null,
      admin,
    };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(sql`${phoneDigitsOf(users.phone)} = ${digits}`)
    .limit(1);
  if (user) {
    const usable = user.isActive && user.isApproved;
    return {
      actor: usable ? { kind: 'user', id: user.id, name: user.fullName } : null,
      user,
      admin: null,
    };
  }

  return { actor: null, user: null, admin: null };
}

export const emptyState = (scene: string): UssdState => ({ scene, stack: [], data: {} });

export async function findSession(db: Db, id: string): Promise<SessionRow | null> {
  const [row] = await db.select().from(ussdSessions).where(eq(ussdSessions.id, id)).limit(1);
  return row ?? null;
}

/** Row lock so two callbacks for the same session cannot interleave a multi-step workflow. */
export async function lockSession(tx: Db, id: string): Promise<SessionRow | null> {
  const [row] = await tx.select().from(ussdSessions).where(eq(ussdSessions.id, id)).limit(1).for('update');
  return row ?? null;
}

export async function upsertSession(
  tx: Db,
  s: {
    id: string;
    phone: string;
    state: UssdState;
    lastText: string;
    actor: Actor | null;
    expiresAt: Date;
    now: Date;
  },
): Promise<void> {
  const values = {
    id: s.id,
    phone: s.phone,
    actorKind: s.actor?.kind ?? null,
    actorId: s.actor?.id ?? null,
    state: s.state as unknown as Record<string, unknown>,
    lastText: s.lastText,
    expiresAt: s.expiresAt,
    createdAt: s.now,
    updatedAt: s.now,
  };
  await tx
    .insert(ussdSessions)
    .values(values)
    .onConflictDoUpdate({
      target: ussdSessions.id,
      set: {
        phone: values.phone,
        actorKind: values.actorKind,
        actorId: values.actorId,
        state: values.state,
        lastText: values.lastText,
        expiresAt: values.expiresAt,
        updatedAt: values.updatedAt,
      },
    });
}

export async function deleteSession(tx: Db, id: string): Promise<void> {
  await tx.delete(ussdSessions).where(eq(ussdSessions.id, id));
}

/**
 * Idempotency key for a callback. Salted with the session id so the digest of a short PIN segment
 * cannot be reversed by trying the 10 000 possible PINs.
 */
export function textDigest(sessionId: string, text: string): string {
  return createHash('sha256').update(`${sessionId}|${text}`).digest('hex');
}

export interface LoggedRequest {
  id: number;
  response: string;
  isEnd: boolean;
}

export async function findLoggedRequest(db: Db, sessionId: string, hash: string): Promise<LoggedRequest | null> {
  const [row] = await db
    .select({ id: ussdRequests.id, response: ussdRequests.response, isEnd: ussdRequests.isEnd })
    .from(ussdRequests)
    .where(and(eq(ussdRequests.sessionId, sessionId), eq(ussdRequests.textHash, hash)))
    .limit(1);
  return row ?? null;
}

export async function writeRequest(
  tx: Db,
  r: {
    sessionId: string;
    phone: string;
    textHash: string;
    text: string;
    response: string;
    isEnd: boolean;
    scene: string;
    actor: Actor | null;
    ip: string;
    durationMs: number;
    now: Date;
  },
): Promise<void> {
  await tx.insert(ussdRequests).values({
    sessionId: r.sessionId,
    phone: r.phone,
    textHash: r.textHash,
    text: r.text,
    response: r.response,
    isEnd: r.isEnd,
    scene: r.scene,
    actorKind: r.actor?.kind ?? null,
    actorId: r.actor?.id ?? null,
    ipAddress: r.ip,
    durationMs: r.durationMs,
    createdAt: r.now,
  });
}

export type SecurityEventType =
  | 'CALLBACK_UNAUTHORIZED'
  | 'CALLBACK_CONTINUITY_VIOLATION'
  | 'DUPLICATE_CALLBACK'
  | 'RATE_LIMITED'
  | 'PIN_FAILED'
  | 'PIN_LOCKED'
  | 'UNAUTHORIZED_ACCESS'
  | 'UNKNOWN_PHONE'
  | 'SESSION_EXPIRED'
  | 'INTERNAL_ERROR';

export async function logSecurityEvent(
  db: Db,
  e: {
    type: SecurityEventType;
    phone?: string | null;
    sessionId?: string | null;
    detail?: string | null;
    ip?: string | null;
    now: Date;
  },
): Promise<void> {
  try {
    await db.insert(ussdSecurityEvents).values({
      eventType: e.type,
      phone: e.phone ?? null,
      sessionId: e.sessionId ?? null,
      detail: e.detail ?? null,
      ipAddress: e.ip ?? null,
      createdAt: e.now,
    });
  } catch {
    // Telemetry must never break a live USSD session.
  }
}

/** Callbacks received from one number in the window, used for abuse rate limiting. */
export async function countRecentCallbacks(db: Db, phone: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)` })
    .from(ussdRequests)
    .where(and(eq(ussdRequests.phone, phone), gte(ussdRequests.createdAt, since)));
  return row?.c ?? 0;
}

export async function recentSecurityEvents(db: Db, limit: number): Promise<{ eventType: string; detail: string | null; createdAt: Date }[]> {
  return db
    .select({ eventType: ussdSecurityEvents.eventType, detail: ussdSecurityEvents.detail, createdAt: ussdSecurityEvents.createdAt })
    .from(ussdSecurityEvents)
    .where(gt(ussdSecurityEvents.id, 0))
    .orderBy(desc(ussdSecurityEvents.createdAt))
    .limit(limit);
}
