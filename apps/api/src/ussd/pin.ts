import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { admins, users } from '../db/schema';
import type { ActorKind } from './machine';

/**
 * Transaction PINs. USSD has no password login, so the PIN is the second factor on every financial
 * or destructive action: it is bcrypt-hashed, never logged, and locks the actor out after a small
 * number of failures.
 */
const COST = 10;

export interface PinPolicy {
  length: number;
  maxAttempts: number;
  lockMinutes: number;
}

export const PIN_POLICY: PinPolicy = { length: 4, maxAttempts: 3, lockMinutes: 15 };

export const isWellFormedPin = (pin: string): boolean =>
  new RegExp(`^\\d{${PIN_POLICY.length}}$`).test(pin);

export const hashPin = (pin: string): Promise<string> => bcrypt.hash(pin, COST);

export type PinCheck =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'locked' | 'invalid'; attemptsLeft: number; minutesLeft: number };

export interface PinState {
  isSet: boolean;
  isLocked: boolean;
  minutesLeft: number;
  attemptsLeft: number;
}

interface PinRow {
  hash: string | null;
  attempts: number;
  lockedUntil: Date | null;
}

/** Reads the PIN columns of either table. The two schemas use different column names. */
async function readRow(db: Db, kind: ActorKind, id: number): Promise<PinRow | null> {
  if (kind === 'admin') {
    const [row] = await db
      .select({ hash: admins.pinHash, attempts: admins.pinAttempts, lockedUntil: admins.pinLockedUntil })
      .from(admins)
      .where(eq(admins.id, id))
      .limit(1);
    return row ?? null;
  }
  const [row] = await db
    .select({
      hash: users.transactionPinHash,
      attempts: users.pinAttempts,
      lockedUntil: users.pinLockedUntil,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

async function writeHash(db: Db, kind: ActorKind, id: number, hash: string | null): Promise<void> {
  if (kind === 'admin') {
    await db
      .update(admins)
      .set({ pinHash: hash, pinAttempts: 0, pinLockedUntil: null })
      .where(eq(admins.id, id));
    return;
  }
  await db
    .update(users)
    .set({ transactionPinHash: hash, pinAttempts: 0, pinLockedUntil: null })
    .where(eq(users.id, id));
}

async function writeAttempts(db: Db, kind: ActorKind, id: number, attempts: number, lock: Date | null): Promise<void> {
  if (kind === 'admin') {
    await db.update(admins).set({ pinAttempts: attempts, pinLockedUntil: lock }).where(eq(admins.id, id));
    return;
  }
  await db.update(users).set({ pinAttempts: attempts, pinLockedUntil: lock }).where(eq(users.id, id));
}

const minutesUntil = (until: Date | null, now: Date): number =>
  until && until.getTime() > now.getTime()
    ? Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000))
    : 0;

export async function readPinState(db: Db, kind: ActorKind, id: number, now: Date): Promise<PinState> {
  const row = await readRow(db, kind, id);
  const minutesLeft = minutesUntil(row?.lockedUntil ?? null, now);
  return {
    isSet: !!row?.hash,
    isLocked: minutesLeft > 0,
    minutesLeft,
    attemptsLeft: Math.max(0, PIN_POLICY.maxAttempts - (row?.attempts ?? 0)),
  };
}

/**
 * Verifies a PIN inside its own write path: failures increment the counter (and lock the actor at
 * the limit), a success clears both the counter and any expired lock.
 */
export async function verifyPin(
  db: Db,
  kind: ActorKind,
  id: number,
  pin: string,
  now: Date,
): Promise<PinCheck> {
  const row = await readRow(db, kind, id);
  if (!row?.hash) {
    return { ok: false, reason: 'missing', attemptsLeft: PIN_POLICY.maxAttempts, minutesLeft: 0 };
  }

  const locked = minutesUntil(row.lockedUntil, now);
  if (locked > 0) return { ok: false, reason: 'locked', attemptsLeft: 0, minutesLeft: locked };

  if (await bcrypt.compare(pin, row.hash)) {
    await writeAttempts(db, kind, id, 0, null);
    return { ok: true };
  }

  const attempts = row.attempts + 1;
  if (attempts >= PIN_POLICY.maxAttempts) {
    await writeAttempts(db, kind, id, 0, new Date(now.getTime() + PIN_POLICY.lockMinutes * 60_000));
    return { ok: false, reason: 'invalid', attemptsLeft: 0, minutesLeft: PIN_POLICY.lockMinutes };
  }
  await writeAttempts(db, kind, id, attempts, null);
  return { ok: false, reason: 'invalid', attemptsLeft: PIN_POLICY.maxAttempts - attempts, minutesLeft: 0 };
}

/**
 * Stores an already-hashed PIN. Required because the two-step enrolment keeps only the hash in
 * session state: a plaintext PIN must never be written to the session or the request log.
 */
export async function storePinHash(db: Db, kind: ActorKind, id: number, hash: string): Promise<void> {
  await writeHash(db, kind, id, hash);
}

export async function storePin(db: Db, kind: ActorKind, id: number, pin: string): Promise<void> {
  await writeHash(db, kind, id, await hashPin(pin));
}

/** Administrator-initiated reset, used when an actor is locked out. Audited by the caller. */
export async function clearPin(db: Db, kind: ActorKind, id: number): Promise<void> {
  await writeHash(db, kind, id, null);
}

export async function pinIsSet(db: Db, kind: ActorKind, id: number): Promise<boolean> {
  return !!(await readRow(db, kind, id))?.hash;
}

export async function lockMinutesLeft(db: Db, kind: ActorKind, id: number, now: Date): Promise<number> {
  return minutesUntil((await readRow(db, kind, id))?.lockedUntil ?? null, now);
}
