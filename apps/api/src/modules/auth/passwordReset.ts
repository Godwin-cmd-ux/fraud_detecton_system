import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { FRAUD } from '@fraud/shared';
import type { Db } from '../../db/client';
import { users } from '../../db/schema';
import { HttpError } from '../../lib/errors';
import { hashPassword, verifyPassword } from '../../lib/password';
import { listActiveQuestions } from './register';
import type { QuestionRow } from './register';

export const RESET_MSG = {
  notFound: 'Email not found. Please check your email address.',
  deactivated: 'Your account has been deactivated. Please contact support.',
  pending: 'Your account is pending admin approval. Please wait for confirmation.',
  insufficient: "Your account doesn't have sufficient security questions set up. Please contact support.",
  needThree: 'Please answer at least 3 security questions.',
  incorrect: (n: number) => `Incorrect answers. Please try again. (${n}/3 correct)`,
  invalidToken: 'Invalid reset token. Please request a new password reset.',
  expiredToken: 'Your reset token has expired (valid for 5 minutes). Please request a new one.',
  success: 'Password reset successfully. You can now sign in with your new password.',
  sessionExpired: 'Your session expired. Please start again.',
};

const MIN_CORRECT = 3;

/** Returns the active questions this user has answered. Throws with the original messages, in order. */
export async function startReset(
  db: Db,
  email: string,
): Promise<{ userId: number; questions: Pick<QuestionRow, 'key' | 'text'>[] }> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new HttpError(404, 'NOT_FOUND', RESET_MSG.notFound);
  if (!user.isActive) throw new HttpError(403, 'DEACTIVATED', RESET_MSG.deactivated);
  if (!user.isApproved) throw new HttpError(403, 'PENDING_APPROVAL', RESET_MSG.pending);

  const answered = user.securityAnswers ?? {};
  const questions = (await listActiveQuestions(db))
    .filter((q) => typeof answered[q.key] === 'string')
    .map((q) => ({ key: q.key, text: q.text }));
  if (questions.length < MIN_CORRECT) {
    throw new HttpError(400, 'INSUFFICIENT_QUESTIONS', RESET_MSG.insufficient);
  }
  return { userId: user.id, questions };
}

/** Compares answers case-sensitively; three correct ones mint a token valid for 5 minutes. */
export async function verifyAnswers(
  db: Db,
  userId: number,
  answers: Record<string, string>,
  now: Date,
): Promise<{ token: string; expiresAt: Date }> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new HttpError(404, 'NOT_FOUND', RESET_MSG.notFound);

  const provided = Object.entries(answers).filter(([, v]) => v.trim());
  if (provided.length < MIN_CORRECT) throw new HttpError(400, 'VALIDATION', RESET_MSG.needThree);

  const stored = user.securityAnswers ?? {};
  let correct = 0;
  for (const [key, value] of provided) {
    const hash = stored[key];
    if (hash && (await verifyPassword(value.trim(), hash))) correct += 1;
  }
  if (correct < MIN_CORRECT) {
    throw new HttpError(400, 'INCORRECT_ANSWERS', RESET_MSG.incorrect(correct));
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(now.getTime() + FRAUD.RESET_TOKEN_TTL_MIN * 60_000);
  await db
    .update(users)
    .set({ resetToken: token, resetTokenExpiry: expiresAt })
    .where(eq(users.id, userId));
  return { token, expiresAt };
}

export type TokenCheck =
  | { valid: true; expiresAt: Date; userName: string }
  | { valid: false; reason: 'INVALID' | 'EXPIRED' };

export async function checkToken(db: Db, token: string, now: Date): Promise<TokenCheck> {
  const [user] = await db.select().from(users).where(eq(users.resetToken, token)).limit(1);
  if (!user || !user.resetTokenExpiry) return { valid: false, reason: 'INVALID' };
  if (now.getTime() > user.resetTokenExpiry.getTime()) return { valid: false, reason: 'EXPIRED' };
  return { valid: true, expiresAt: user.resetTokenExpiry, userName: user.fullName };
}

export async function resetPassword(db: Db, token: string, password: string, now: Date): Promise<void> {
  const check = await checkToken(db, token, now);
  if (!check.valid) {
    if (check.reason === 'EXPIRED') throw new HttpError(400, 'EXPIRED_TOKEN', RESET_MSG.expiredToken);
    throw new HttpError(400, 'INVALID_TOKEN', RESET_MSG.invalidToken);
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), resetToken: null, resetTokenExpiry: null })
    .where(eq(users.resetToken, token));
}
