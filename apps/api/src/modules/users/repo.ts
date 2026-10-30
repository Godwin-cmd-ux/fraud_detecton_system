import { and, asc, eq, ne, or, sql } from 'drizzle-orm';
import type { Coordinates, Location } from '@fraud/shared';
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

/** Active account holding this virtual card number; `null` when no one does. */
export async function findUserByCard(db: Db, cardNumber: string): Promise<UserRow | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.cardNumber, cardNumber), eq(users.isActive, true)))
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

/**
 * Records where the customer transacted. The city keeps every existing fraud rule working; the raw
 * coordinates are kept alongside as evidence when the channel provided them.
 */
export async function updateUserLocation(
  tx: Db,
  userId: number,
  location: Location,
  coordinates?: Coordinates,
): Promise<void> {
  await tx
    .update(users)
    .set({
      lastKnownLocation: location,
      locationUpdatedAt: sql`now()`,
      ...(coordinates && {
        lastLat: coordinates.latitude.toFixed(6),
        lastLng: coordinates.longitude.toFixed(6),
      }),
    })
    .where(eq(users.id, userId));
}
