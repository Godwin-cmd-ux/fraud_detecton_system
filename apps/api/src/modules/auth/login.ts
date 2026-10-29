import { and, eq, or } from 'drizzle-orm';
import { FRAUD } from '@fraud/shared';
import type { Principal } from '@fraud/shared';
import type { Db } from '../../db/client';
import { admins } from '../../db/schema';
import { HttpError } from '../../lib/errors';
import { verifyPassword } from '../../lib/password';
import { findUserByLogin } from '../users/repo';
import { getLockout, recordFailure, resetAttempts } from './lockout';

export interface LoginArgs {
  role: 'user' | 'admin';
  login: string;
  password: string;
  ip: string;
  now: Date;
}

export const MSG = {
  locked: (m: number) => `Your account is locked. Please wait ${m} minute(s) before trying again.`,
  lockedNow: `Too many failed attempts. Account locked for ${FRAUD.LOGIN_LOCKOUT_MIN} minute(s).`,
  invalid: (role: 'user' | 'admin', remaining: number) =>
    `Invalid ${role} credentials. ${remaining} attempt(s) remaining before lockout.`,
  pending: 'Your account is pending admin approval. Please wait for confirmation.',
};

export async function login(db: Db, a: LoginArgs): Promise<Principal> {
  const lock = await getLockout(db, a.login, a.ip, a.now);
  if (lock.locked) {
    throw new HttpError(423, 'LOCKED', MSG.locked(lock.minutesRemaining), {
      lockedUntil: lock.lockoutUntil.toISOString(),
      minutesRemaining: String(lock.minutesRemaining),
    });
  }

  const principal = a.role === 'admin' ? await adminLogin(db, a) : await userLogin(db, a);
  if (principal) {
    await resetAttempts(db, a.login, a.ip);
    return principal;
  }

  const failure = await recordFailure(db, a.login, a.ip, null, a.now);
  if (failure.lockoutUntil) {
    throw new HttpError(423, 'LOCKED', MSG.lockedNow, {
      lockedUntil: failure.lockoutUntil.toISOString(),
      minutesRemaining: String(FRAUD.LOGIN_LOCKOUT_MIN),
    });
  }
  const remaining = FRAUD.LOGIN_MAX_FAILURES - failure.attemptCount;
  throw new HttpError(401, 'INVALID_CREDENTIALS', MSG.invalid(a.role, remaining), {
    attemptsRemaining: String(remaining),
  });
}

async function adminLogin(db: Db, a: LoginArgs): Promise<Principal | null> {
  const [admin] = await db
    .select()
    .from(admins)
    .where(and(or(eq(admins.username, a.login), eq(admins.email, a.login)), eq(admins.isActive, true)))
    .limit(1);
  if (!admin || !(await verifyPassword(a.password, admin.passwordHash))) return null;
  await db.update(admins).set({ lastLogin: a.now }).where(eq(admins.id, admin.id));
  return { kind: 'admin', id: admin.id, name: admin.fullName, email: admin.email };
}

async function userLogin(db: Db, a: LoginArgs): Promise<Principal | null> {
  const user = await findUserByLogin(db, a.login);
  if (!user || !(await verifyPassword(a.password, user.passwordHash))) return null;
  if (!user.isApproved) throw new HttpError(403, 'PENDING_APPROVAL', MSG.pending);
  return { kind: 'user', id: user.id, name: user.fullName, email: user.email };
}
