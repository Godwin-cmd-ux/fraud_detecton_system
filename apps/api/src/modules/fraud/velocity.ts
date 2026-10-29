import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { FRAUD, LOCATIONS } from '@fraud/shared';
import type { Location } from '@fraud/shared';
import type { Db } from '../../db/client';
import { failedWithdrawalAttempts, transactions } from '../../db/schema';
import { num } from '../../lib/money';
import { hoursAgo, minutesAgo } from '../../lib/time';
import { distanceKm } from './location';
import type { LocationChange } from './location';
import type { VelocityContext } from './patterns';

export interface VelocityArgs {
  senderId: number;
  receiverId?: number;
  now: Date;
}

/**
 * Every counter mirrors the original system: windows are measured against `now`,
 * and ABORTED rows count, so a blocked attempt still moves the user toward the next limit.
 */
export async function getVelocityContext(db: Db, a: VelocityArgs): Promise<VelocityContext> {
  const t5 = minutesAgo(a.now, 5);
  const t7 = minutesAgo(a.now, FRAUD.MANY_SENDERS_WINDOW_MIN);
  const t10 = minutesAgo(a.now, FRAUD.FAILED_WITHDRAWALS_WINDOW_MIN);
  const large = FRAUD.LARGE_TX_THRESHOLD;

  const [sender] = await db
    .select({
      count: sql<number>`count(*)::int`,
      amount: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      largeCount: sql<number>`count(*) filter (where ${transactions.amount} > ${large})::int`,
      largeSum: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.amount} > ${large}), 0)`,
      uniqueReceivers: sql<number>`count(distinct ${transactions.receiverId})::int`,
    })
    .from(transactions)
    .where(and(eq(transactions.senderId, a.senderId), gte(transactions.createdAt, t5)));

  const [incoming] = await db
    .select({ uniqueSenders: sql<number>`count(distinct ${transactions.senderId})::int` })
    .from(transactions)
    .where(and(eq(transactions.receiverId, a.senderId), gte(transactions.createdAt, t5)));

  const [failed] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(
        eq(transactions.senderId, a.senderId),
        eq(transactions.transactionType, 'withdrawal'),
        eq(transactions.status, 'ABORTED'),
        gte(transactions.createdAt, t10),
      ),
    );

  const [avg] = await db
    .select({ avg: sql<string>`coalesce(avg(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(eq(transactions.senderId, a.senderId), eq(transactions.status, 'SUCCESS')));

  let receiverAlreadyInWindow = false;
  let uniqueSendersToReceiverLast7Min = 0;
  let senderAlreadyInReceiverWindow = false;

  if (a.receiverId !== undefined) {
    const [pair5] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(
        and(
          eq(transactions.senderId, a.senderId),
          eq(transactions.receiverId, a.receiverId),
          gte(transactions.createdAt, t5),
        ),
      );
    receiverAlreadyInWindow = (pair5?.count ?? 0) > 0;

    const [recv] = await db
      .select({ uniqueSenders: sql<number>`count(distinct ${transactions.senderId})::int` })
      .from(transactions)
      .where(
        and(
          eq(transactions.receiverId, a.receiverId),
          isNotNull(transactions.senderId),
          gte(transactions.createdAt, t7),
        ),
      );
    uniqueSendersToReceiverLast7Min = recv?.uniqueSenders ?? 0;

    const [pair7] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(
        and(
          eq(transactions.receiverId, a.receiverId),
          eq(transactions.senderId, a.senderId),
          gte(transactions.createdAt, t7),
        ),
      );
    senderAlreadyInReceiverWindow = (pair7?.count ?? 0) > 0;
  }

  return {
    transactionCountLast5Min: sender?.count ?? 0,
    amountLast5Min: num(sender?.amount),
    largeCountLast5Min: sender?.largeCount ?? 0,
    largeSumLast5Min: num(sender?.largeSum),
    uniqueReceiversLast5Min: sender?.uniqueReceivers ?? 0,
    receiverAlreadyInWindow,
    uniqueSendersToReceiverLast7Min,
    senderAlreadyInReceiverWindow,
    uniqueSendersLast5Min: incoming?.uniqueSenders ?? 0,
    failedWithdrawalsLast10Min: failed?.count ?? 0,
    avgUserAmount: num(avg?.avg),
  };
}

export interface LocationArgs {
  userId: number;
  newLocation: Location;
  now: Date;
}

/** Compares against the user's most recent located transaction in the last 5 minutes. */
export async function getLocationChange(db: Db, a: LocationArgs): Promise<LocationChange> {
  const window = FRAUD.LOCATION_WINDOW_MIN;
  const [last] = await db
    .select({ location: transactions.transactionLocation })
    .from(transactions)
    .where(
      and(
        eq(transactions.senderId, a.userId),
        isNotNull(transactions.transactionLocation),
        gte(transactions.createdAt, minutesAgo(a.now, window)),
      ),
    )
    .orderBy(desc(transactions.createdAt))
    .limit(1);

  const previous = last?.location as Location | undefined;
  if (!previous || previous === a.newLocation) {
    return { changed: false, newLocation: a.newLocation, timeElapsedMinutes: window };
  }
  const known = (LOCATIONS as readonly string[]).includes(previous);
  return {
    changed: true,
    previousLocation: previous,
    newLocation: a.newLocation,
    distanceKm: known ? distanceKm(previous, a.newLocation) : undefined,
    timeElapsedMinutes: window,
  };
}

/** Resets stale rows (older than 24 h), then returns the user's current failed-attempt count. */
export async function getFailedWithdrawalCount(db: Db, userId: number, now: Date): Promise<number> {
  await db
    .update(failedWithdrawalAttempts)
    .set({ attemptCount: 0, lastAttemptTime: null })
    .where(
      and(
        sql`${failedWithdrawalAttempts.lastAttemptTime} < ${hoursAgo(now, FRAUD.FAILED_WITHDRAWAL_RESET_HOURS)}`,
        sql`${failedWithdrawalAttempts.attemptCount} > 0`,
      ),
    );
  const [row] = await db
    .select({ count: failedWithdrawalAttempts.attemptCount })
    .from(failedWithdrawalAttempts)
    .where(eq(failedWithdrawalAttempts.userId, userId));
  return row?.count ?? 0;
}

export async function incrementFailedWithdrawal(tx: Db, userId: number, now: Date): Promise<number> {
  const [row] = await tx
    .insert(failedWithdrawalAttempts)
    .values({ userId, attemptCount: 1, lastAttemptTime: now })
    .onConflictDoUpdate({
      target: failedWithdrawalAttempts.userId,
      set: {
        attemptCount: sql`${failedWithdrawalAttempts.attemptCount} + 1`,
        lastAttemptTime: now,
      },
    })
    .returning({ count: failedWithdrawalAttempts.attemptCount });
  return row?.count ?? 1;
}

export async function resetFailedWithdrawals(tx: Db, userId: number): Promise<void> {
  await tx
    .insert(failedWithdrawalAttempts)
    .values({ userId, attemptCount: 0, lastAttemptTime: null })
    .onConflictDoUpdate({
      target: failedWithdrawalAttempts.userId,
      set: { attemptCount: 0, lastAttemptTime: null },
    });
}
