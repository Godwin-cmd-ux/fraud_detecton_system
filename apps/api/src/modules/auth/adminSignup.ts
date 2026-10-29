import { eq, or, sql } from 'drizzle-orm';
import type { AdminSignupInput } from '@fraud/shared';
import type { Db } from '../../db/client';
import { admins } from '../../db/schema';
import { HttpError } from '../../lib/errors';
import { hashPassword } from '../../lib/password';

export const INVALID_KEY_MSG = "❌ Invalid secret key. You don't have permission to create admin accounts.";

export async function isFirstAdmin(db: Db): Promise<boolean> {
  const [row] = await db.select({ c: sql<number>`count(*)::int` }).from(admins);
  return (row?.c ?? 0) === 0;
}

/** The first admin needs no key; afterwards `secretKey` must equal the configured setup key. */
export async function adminSignup(
  db: Db,
  input: AdminSignupInput,
  setupKey: string,
): Promise<{ id: number }> {
  if (!(await isFirstAdmin(db)) && input.secretKey !== setupKey) {
    throw new HttpError(403, 'INVALID_KEY', INVALID_KEY_MSG);
  }
  const [dup] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(or(eq(admins.username, input.username), eq(admins.email, input.email)))
    .limit(1);
  if (dup) throw new HttpError(409, 'DUPLICATE', 'Username or email already exists');

  const [row] = await db
    .insert(admins)
    .values({
      username: input.username,
      email: input.email,
      fullName: input.fullName,
      passwordHash: await hashPassword(input.password),
    })
    .returning({ id: admins.id });
  return { id: row!.id };
}
