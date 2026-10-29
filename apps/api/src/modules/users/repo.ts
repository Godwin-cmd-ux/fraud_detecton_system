import { and, asc, eq, ne, or, sql } from 'drizzle-orm';
import type { Location } from '@fraud/shared';
import type { Db } from '../../db/client';
import { users } from '../../db/schema';

export type UserRow = typeof users.$inferSelect;

export async function findUserById(db: Db, id: number): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function findActiveUserById(db: Db, id: number): Promise<UserRow | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.isActive, true)))
    .limit(1);
  return row ?? null;
}

/** Active user matched by email, phone or card number (exact match, as the original). */
export async function findUserByLogin(db: Db, login: string): Promise<UserRow | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(
      and(
        or(eq(users.email, login), eq(users.phone, login), eq(users.cardNumber, login)),
        eq(users.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

export interface Recipient {
  id: number;
  fullName: string;
  email: string;
  phone: string;
}

/** Other active, approved users, ordered by name. */
export async function listRecipients(db: Db, excludeId: number): Promise<Recipient[]> {
  return db
    .select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone })
    .from(users)
    .where(and(ne(users.id, excludeId), eq(users.isActive, true), eq(users.isApproved, true)))
    .orderBy(asc(users.fullName));
}

export async function updateUserLocation(tx: Db, userId: number, location: Location): Promise<void> {
  await tx
    .update(users)
    .set({ lastKnownLocation: location, locationUpdatedAt: sql`now()` })
    .where(eq(users.id, userId));
}
