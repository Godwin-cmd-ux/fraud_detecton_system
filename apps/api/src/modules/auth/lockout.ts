import { and, desc, eq, gt, or } from 'drizzle-orm';
import { FRAUD } from '@fraud/shared';
import type { Db } from '../../db/client';
import { failedLoginLog, loginAttempts } from '../../db/schema';

export type LockoutState =
  | { locked: false }
  | { locked: true; lockoutUntil: Date; minutesRemaining: number };

/** Locked when any row for this login string OR this IP still has a future lockout. */
export async function getLockout(db: Db, login: string, ip: string, now: Date): Promise<LockoutState> {
  const [row] = await db
    .select({ lockoutUntil: loginAttempts.lockoutUntil })
    .from(loginAttempts)
    .where(
      and(
        or(eq(loginAttempts.email, login), eq(loginAttempts.ipAddress, ip)),
        gt(loginAttempts.lockoutUntil, now),
      ),
    )
    .orderBy(desc(loginAttempts.lockoutUntil))
    .limit(1);
  if (!row?.lockoutUntil) return { locked: false };
  const minutesRemaining = Math.max(1, Math.ceil((row.lockoutUntil.getTime() - now.getTime()) / 60_000));
  return { locked: true, lockoutUntil: row.lockoutUntil, minutesRemaining };
}

export interface FailureResult {
  attemptCount: number;
  lockoutUntil: Date | null;
}

/**
 * Increments the (login, ip) counter and locks for 5 minutes at the third failure.
 * A failure after an expired lockout restarts the counter at 1.
 */
export async function recordFailure(
  db: Db,
  login: string,
  ip: string,
  userId: number | null,
  now: Date,
): Promise<FailureResult> {
  const [existing] = await db
    .select()
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, login), eq(loginAttempts.ipAddress, ip)))
    .orderBy(desc(loginAttempts.createdAt))
    .limit(1);

  const expired = !!existing?.lockoutUntil && existing.lockoutUntil.getTime() <= now.getTime();
  const attemptCount = existing && !expired ? existing.attemptCount + 1 : 1;
  const lockoutUntil =
    attemptCount >= FRAUD.LOGIN_MAX_FAILURES
      ? new Date(now.getTime() + FRAUD.LOGIN_LOCKOUT_MIN * 60_000)
      : null;

  if (existing) {
    await db
      .update(loginAttempts)
      .set({ attemptCount, lockoutUntil, userId, updatedAt: now })
      .where(eq(loginAttempts.id, existing.id));
  } else {
    await db.insert(loginAttempts).values({
      email: login,
      ipAddress: ip,
      userId,
      attemptCount,
      lockoutUntil,
      createdAt: now,
      updatedAt: now,
    });
  }

  await db.insert(failedLoginLog).values({ email: login, ipAddress: ip, userId, attemptedAt: now });
  return { attemptCount, lockoutUntil };
}

export async function resetAttempts(db: Db, login: string, ip: string): Promise<void> {
  await db
    .update(loginAttempts)
    .set({ attemptCount: 0, lockoutUntil: null })
    .where(and(eq(loginAttempts.email, login), eq(loginAttempts.ipAddress, ip)));
}
