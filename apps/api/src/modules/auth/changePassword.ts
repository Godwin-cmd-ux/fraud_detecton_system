import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { users } from '../../db/schema';
import { HttpError } from '../../lib/errors';
import { hashPassword, matchesPhonePassword, verifyPassword } from '../../lib/password';
import { findActiveUserById } from '../users/repo';

/**
 * Changes the signed-in customer's password.
 *
 * The current password is required even though the request already carries a session cookie: a
 * borrowed laptop must not be enough to take over the account. USSD-registered customers start
 * with their phone number as the password, so the current-password check accepts the number in any
 * punctuation, matching how the login form treats it.
 */
export async function changePassword(
  db: Db,
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await findActiveUserById(db, userId);
  if (!user) throw new HttpError(404, 'NOT_FOUND', 'User not found.');

  const currentOk =
    (await verifyPassword(currentPassword, user.passwordHash)) ||
    (await matchesPhonePassword(currentPassword, user.phone, user.passwordHash));
  if (!currentOk) {
    throw new HttpError(401, 'INCORRECT_PASSWORD', 'Your current password is incorrect.');
  }

  const unchanged =
    (await verifyPassword(newPassword, user.passwordHash)) ||
    (await matchesPhonePassword(newPassword, user.phone, user.passwordHash));
  if (unchanged) {
    throw new HttpError(400, 'SAME_PASSWORD', 'Choose a password different from your current one.');
  }

  await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, userId));
}
