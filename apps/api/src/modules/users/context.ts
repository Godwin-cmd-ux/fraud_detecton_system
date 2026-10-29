import { DEFAULT_LOCATION, FRAUD, LOCATIONS } from '@fraud/shared';
import type { Location } from '@fraud/shared';
import type { Db } from '../../db/client';
import { HttpError } from '../../lib/errors';
import { num } from '../../lib/money';
import { getFailedWithdrawalCount, getVelocityContext } from '../fraud/velocity';
import { findActiveUserById, listRecipients } from './repo';
import type { Recipient } from './repo';

export interface SendContext {
  balance: number;
  recipients: Recipient[];
  locations: readonly Location[];
  defaultLocation: Location;
  largeVolume: { count: number; totalAmount: number; blocked: boolean };
  receivers: { unique: number; blocked: boolean };
  senders: { unique: number; blocked: boolean };
}

export interface WithdrawContext {
  balance: number;
  locations: readonly Location[];
  defaultLocation: Location;
  failedAttempts: number;
  blocked: boolean;
}

function defaultLocationOf(last: string | null): Location {
  return (LOCATIONS as readonly string[]).includes(last ?? '') ? (last as Location) : DEFAULT_LOCATION;
}

export async function getSendContext(
  db: Db,
  userId: number,
  receiverId: number | undefined,
  now: Date,
): Promise<SendContext> {
  const user = await findActiveUserById(db, userId);
  if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Your account is no longer active');
  const ctx = await getVelocityContext(db, { senderId: userId, receiverId, now });
  return {
    balance: num(user.balance),
    recipients: await listRecipients(db, userId),
    locations: LOCATIONS,
    defaultLocation: defaultLocationOf(user.lastKnownLocation),
    largeVolume: {
      count: ctx.largeCountLast5Min,
      totalAmount: ctx.largeSumLast5Min,
      blocked:
        ctx.largeCountLast5Min >= FRAUD.LARGE_VOLUME_MAX_COUNT &&
        ctx.largeSumLast5Min > FRAUD.LARGE_VOLUME_MAX_SUM,
    },
    receivers: {
      unique: ctx.uniqueReceiversLast5Min,
      blocked: ctx.uniqueReceiversLast5Min >= FRAUD.MANY_RECEIVERS_BLOCK_AT,
    },
    senders: {
      unique: ctx.uniqueSendersToReceiverLast7Min,
      blocked: ctx.uniqueSendersToReceiverLast7Min >= FRAUD.MANY_SENDERS_BLOCK_AT,
    },
  };
}

export async function getWithdrawContext(db: Db, userId: number, now: Date): Promise<WithdrawContext> {
  const user = await findActiveUserById(db, userId);
  if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Your account is no longer active');
  const failedAttempts = await getFailedWithdrawalCount(db, userId, now);
  return {
    balance: num(user.balance),
    locations: LOCATIONS,
    defaultLocation: defaultLocationOf(user.lastKnownLocation),
    failedAttempts,
    blocked: failedAttempts >= FRAUD.FAILED_WITHDRAWAL_BLOCK_COUNT,
  };
}
