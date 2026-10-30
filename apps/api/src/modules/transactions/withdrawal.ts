import { FEES, FRAUD, feeFor, totalWithFee } from '@fraud/shared';
import type { Coordinates, Location, WithdrawalResult } from '@fraud/shared';
import { HttpError, ValidationError } from '../../lib/errors';
import { resolveLocation, storedLocation } from '../../lib/geo';
import { newTransactionId } from '../../lib/ids';
import { formatTsh, num } from '../../lib/money';
import { hourInDar } from '../../lib/time';
import { buildFeatures } from '../fraud/features';
import { locationScore } from '../fraud/location';
import { scoreWithMl } from '../fraud/mlClient';
import { applyWithdrawalRules } from '../fraud/rules';
import {
  getFailedWithdrawalCount,
  getLocationChange,
  getVelocityContext,
  incrementFailedWithdrawal,
  resetFailedWithdrawals,
} from '../fraud/velocity';
import { notifyTransactionBlocked, notifyWithdrawal } from '../sms/notifications';
import { findActiveUserById, updateUserLocation } from '../users/repo';
import type { UserRow } from '../users/repo';
import { debitBalance, insertTransaction } from './repo';
import type { NewTransaction } from './repo';
import { BLOCKED_TEXT } from './transfer';
import type { TransferDeps } from './transfer';

export interface WithdrawalCommand {
  userId: number;
  amount: number;
  /** 1.1% of `amount`, charged to the customer; set by `executeWithdrawal`. */
  fee?: number;
  /** Explicit city, for channels without geolocation. The web app sends `coordinates` instead. */
  location?: Location;
  coordinates?: Coordinates;
  message?: string;
  ip: string | null;
  userAgent: string | null;
}

export const WITHDRAWAL_LOCKED_TEXT =
  '❌ WITHDRAWAL BLOCKED\n\nYour withdrawals are temporarily blocked due to multiple consecutive failed withdrawal attempts.\nPlease contact support to unblock your account.';
export const INSUFFICIENT_TEXT = 'Insufficient balance. Please try a lower amount.';

function baseRow(c: WithdrawalCommand, user: UserRow, now: Date, location: Location): NewTransaction {
  return {
    transactionId: newTransactionId(now),
    senderId: user.id,
    receiverId: null,
    senderName: user.fullName,
    receiverName: null,
    amount: c.amount,
    fee: c.fee,
    transactionType: 'withdrawal',
    status: 'ABORTED',
    message: null,
    fraudScore: 0,
    fraudPrediction: null,
    riskLevel: null,
    predictionTime: null,
    modelVersion: null,
    featureData: null,
    transactionLocation: location,
    ...(c.coordinates && {
      txLat: c.coordinates.latitude.toFixed(6),
      txLng: c.coordinates.longitude.toFixed(6),
    }),
    ipAddress: c.ip,
    userAgent: c.userAgent,
    adminId: null,
  };
}

export async function executeWithdrawal(d: TransferDeps, c: WithdrawalCommand): Promise<WithdrawalResult> {
  const now = d.now();
  const user = await findActiveUserById(d.db, c.userId);
  if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Your account is no longer active');
  const message = c.message ?? '';
  // Coordinates when the app has them, the explicit city next (USSD), the stored one last.
  const location = resolveLocation(c.coordinates, c.location ?? storedLocation(user.lastKnownLocation));
  // Revenue: the customer pays 1.1% on top of the cash withdrawn.
  const fee = feeFor(c.amount, FEES.WITHDRAWAL_RATE);
  const total = totalWithFee(c.amount, FEES.WITHDRAWAL_RATE);
  const row = baseRow({ ...c, fee }, user, now, location);

  // 1. Lockout after three consecutive failed attempts (stale counters reset inside).
  const failedCount = await getFailedWithdrawalCount(d.db, user.id, now);
  if (failedCount >= FRAUD.FAILED_WITHDRAWAL_BLOCK_COUNT) {
    const inserted = await insertTransaction(d.db, {
      ...row,
      message: `BLOCKED: User has ${failedCount} consecutive failed withdrawal attempts | ${message}`,
      fraudScore: 95,
      fraudPrediction: 'FRAUD',
      riskLevel: 'HIGH',
    });
    void notifyTransactionBlocked(d.sms, {
      phone: user.phone,
      kind: 'withdrawal',
      reason: 'multiple consecutive failed withdrawal attempts',
      reference: inserted.transactionId,
    }).catch(() => undefined);
    return {
      outcome: 'blocked',
      reason: 'Multiple consecutive failed withdrawal attempts',
      message: WITHDRAWAL_LOCKED_TEXT,
      riskScore: 95,
      riskLevel: 'HIGH',
      transactionId: inserted.transactionId,
    };
  }

  // 2. Location score (no warning text on withdrawals).
  const change = await getLocationChange(d.db, { userId: user.id, newLocation: location, now });
  const locScore = locationScore(change);

  // 3. Validation; an insufficient balance is a recorded failed attempt.
  const balance = num(user.balance);
  const errors: string[] = [];
  if (c.amount <= 0) errors.push('Amount must be greater than 0');
  else if (c.amount < FRAUD.MIN_WITHDRAWAL) errors.push('Minimum withdrawal amount is TSh 1,000');
  if (errors.length) throw new ValidationError(errors);

  if (total > balance) {
    return d.db.transaction(async (tx) => {
      const n = await incrementFailedWithdrawal(tx, user.id, now);
      await insertTransaction(tx, {
        ...row,
        message: `FAILED: Insufficient balance (Attempt ${n}) | ${message}`,
        fraudScore: Math.min(50 + n * 10, 100),
        fraudPrediction: 'PENDING',
        riskLevel: 'MEDIUM',
      });
      return {
        outcome: 'failed',
        message: INSUFFICIENT_TEXT,
        failedAttempts: n,
        blocked: n >= FRAUD.FAILED_WITHDRAWAL_BLOCK_COUNT,
      };
    });
  }

  // 4. ML score.
  const ctx = await getVelocityContext(d.db, { senderId: user.id, now });
  const hour = hourInDar(now);
  const features = buildFeatures({ amount: c.amount, hour, balance, accountCreatedAt: user.createdAt, now, ctx });
  const { result: ml } = await scoreWithMl(d.ml, features);

  // 5. Rules.
  const outcome = applyWithdrawalRules({ amount: c.amount, balance, hour, locationScore: locScore, ctx }, ml);
  const scored: NewTransaction = {
    ...row,
    fraudScore: outcome.fraudScore,
    fraudPrediction: outcome.fraudPrediction,
    riskLevel: outcome.riskLevel,
    predictionTime: ml.predictionTime,
    modelVersion: ml.modelVersion,
    featureData: { ...features },
  };

  // 6. Commit.
  const result = await d.db.transaction(async (tx): Promise<WithdrawalResult> => {
    if (outcome.block) {
      const reason = outcome.blockReason ?? 'Fraud detected';
      const inserted = await insertTransaction(tx, { ...scored, status: 'ABORTED', message: `BLOCKED: ${reason} | ${message}` });
      return {
        outcome: 'blocked',
        reason,
        message: BLOCKED_TEXT('Withdrawal', reason, outcome.fraudScore, outcome.riskLevel),
        riskScore: outcome.fraudScore,
        riskLevel: outcome.riskLevel,
        transactionId: inserted.transactionId,
      };
    }

    await resetFailedWithdrawals(tx, user.id);
    if (!(await debitBalance(tx, user.id, total))) {
      throw new HttpError(409, 'DEBIT_FAILED', 'Failed to process withdrawal');
    }
    await updateUserLocation(tx, user.id, location, c.coordinates);
    const inserted = await insertTransaction(tx, { ...scored, status: 'SUCCESS', message: message || null });
    return {
      outcome: 'success',
      message: `Withdrawal successful! You withdrew ${formatTsh(c.amount)}`,
      transactionId: inserted.transactionId,
      newBalance: Math.round((balance - total) * 100) / 100,
      riskScore: outcome.fraudScore,
      riskLevel: outcome.riskLevel,
      fraudPrediction: outcome.fraudPrediction,
      createdAt: inserted.createdAt.toISOString(),
      flaggedForReview: false,
    };
  });

  // 7. Confirm the withdrawal by SMS once the row is committed.
  if (result.outcome === 'success') {
    void notifyWithdrawal(d.sms, {
      userName: user.fullName,
      phone: user.phone,
      amount: c.amount,
      balance: result.newBalance,
      reference: result.transactionId,
    }).catch(() => undefined);
  } else if (result.outcome === 'blocked') {
    void notifyTransactionBlocked(d.sms, {
      phone: user.phone,
      kind: 'withdrawal',
      reason: result.reason,
      reference: result.transactionId,
    }).catch(() => undefined);
  }

  return result;
}
