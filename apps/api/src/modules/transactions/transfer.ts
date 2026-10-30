import { FEES, feeFor, totalWithFee } from '@fraud/shared';
import type { Coordinates, Location, RiskLevel, TransferResult } from '@fraud/shared';
import type { Db } from '../../db/client';
import { HttpError, ValidationError } from '../../lib/errors';
import { resolveLocation, storedLocation } from '../../lib/geo';
import { newTransactionId } from '../../lib/ids';
import { formatTsh, num } from '../../lib/money';
import { hourInDar } from '../../lib/time';
import { buildFeatures } from '../fraud/features';
import { locationScore, locationWarning } from '../fraud/location';
import { scoreWithMl } from '../fraud/mlClient';
import type { MlClient } from '../fraud/mlClient';
import { checkLargeVolume, checkManyReceivers, checkManySenders } from '../fraud/patterns';
import type { PatternBlock, VelocityContext } from '../fraud/patterns';
import { applyTransferRules, isFlaggedForReview } from '../fraud/rules';
import { getLocationChange, getVelocityContext } from '../fraud/velocity';
import { notifyTransactionBlocked, notifyTransferReceived, notifyTransferSent } from '../sms/notifications';
import type { SmsClient } from '../sms/client';
import { findActiveUserById, findUserByCard, findUserById, updateUserLocation } from '../users/repo';
import type { UserRow } from '../users/repo';
import { creditBalance, debitBalance, insertTransaction } from './repo';
import type { NewTransaction } from './repo';

export interface TransferDeps {
  db: Db;
  ml: MlClient;
  now: () => Date;
  /** Absent in tests and when SMS is not configured. */
  sms?: SmsClient;
}

export interface TransferCommand {
  userId: number;
  /** Addressed by id (USSD, tests) or by the recipient's card number (web form). */
  receiverId?: number;
  cardNumber?: string;
  amount: number;
  /** 0.8% of `amount`, charged to the sender; set by `executeTransfer`. */
  fee?: number;
  /** Explicit city, for channels without geolocation. The web app sends `coordinates` instead. */
  location?: Location;
  coordinates?: Coordinates;
  message?: string;
  ip: string | null;
  userAgent: string | null;
}

export const BLOCKED_TEXT = (kind: 'Transaction' | 'Withdrawal', reason: string, score: number, level: RiskLevel) =>
  `❌ ${kind} BLOCKED due to fraud detection.\n\nReason: ${reason}\nRisk Score: ${score}%\nRisk Level: ${level}\n\nPlease contact support if you believe this is a mistake.`;

/** Fields shared by every transfer row written by this pipeline. */
function baseRow(
  location: Location,
  receiverId: number,
  c: TransferCommand,
  sender: UserRow,
  receiverName: string,
  now: Date,
): NewTransaction {
  return {
    transactionId: newTransactionId(now),
    senderId: sender.id,
    receiverId,
    senderName: sender.fullName,
    receiverName,
    amount: c.amount,
    fee: c.fee,
    transactionType: 'transfer',
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

async function recordPatternBlock(
  db: Db,
  row: NewTransaction,
  block: PatternBlock,
  locationWarningText?: string,
): Promise<TransferResult> {
  const inserted = await insertTransaction(db, {
    ...row,
    status: 'ABORTED',
    message: block.dbMessage,
    fraudScore: block.score,
    fraudPrediction: 'FRAUD',
    riskLevel: 'HIGH',
  });
  return {
    outcome: 'blocked',
    reason: block.userMessage,
    message: `❌ TRANSACTION BLOCKED\n\n${block.userMessage}`,
    riskScore: block.score,
    riskLevel: 'HIGH',
    transactionId: inserted.transactionId,
    ...(locationWarningText && { locationWarning: locationWarningText }),
  };
}

export async function executeTransfer(d: TransferDeps, c: TransferCommand): Promise<TransferResult> {
  const now = d.now();
  const sender = await findActiveUserById(d.db, c.userId);
  if (!sender) throw new HttpError(401, 'UNAUTHENTICATED', 'Your account is no longer active');

  // The recipient is whichever account holds the card number typed (web) or the id sent (USSD).
  const requestedId = c.receiverId && c.receiverId > 0 ? c.receiverId : null;
  const receiverRow = requestedId
    ? await findUserById(d.db, requestedId)
    : c.cardNumber
      ? await findUserByCard(d.db, c.cardNumber)
      : null;
  const receiverId = receiverRow?.id ?? requestedId ?? 0;

  // Silent geolocation: the browser reports coordinates, the rules keep seeing a city. Channels
  // without a GPS (USSD) send the city itself, and a reading far from every city keeps it.
  const location = resolveLocation(
    c.coordinates,
    c.location ?? storedLocation(sender.lastKnownLocation),
  );
  // Revenue: the sender pays 0.8% on top of the amount; the receiver gets the full amount.
  const fee = feeFor(c.amount, FEES.TRANSFER_RATE);
  const total = totalWithFee(c.amount, FEES.TRANSFER_RATE);
  const receiverName = receiverRow?.fullName ?? 'Unknown';
  const message = c.message ?? '';
  const ctx: VelocityContext = await getVelocityContext(d.db, {
    senderId: sender.id,
    receiverId,
    now,
  });
  const row = baseRow(location, receiverId, { ...c, fee }, sender, receiverName, now);

  // 1-3. Velocity patterns, first block wins.
  const pattern =
    checkLargeVolume(c.amount, ctx, message) ??
    checkManyReceivers(ctx, message) ??
    checkManySenders(ctx, message);
  if (pattern) {
    const blocked = await recordPatternBlock(d.db, row, pattern);
    void notifyTransactionBlocked(d.sms, {
      phone: sender.phone,
      kind: 'transfer',
      reason: pattern.userMessage,
      reference: blocked.transactionId,
    }).catch(() => undefined);
    return blocked;
  }

  // 4. Location.
  const change = await getLocationChange(d.db, { userId: sender.id, newLocation: location, now });
  const locScore = locationScore(change);
  const warning = locationWarning(change);

  // 5. Validation (writes nothing).
  const balance = num(sender.balance);
  const errors: string[] = [];
  if (receiverId <= 0) errors.push('Enter the recipient card number');
  if (receiverId === sender.id) errors.push('You cannot send money to yourself');
  if (c.amount <= 0) errors.push('Amount must be greater than 0');
  if (total > balance)
    errors.push(
      `Insufficient balance. Your balance is ${formatTsh(balance)} (amount ${formatTsh(c.amount)} + fee ${formatTsh(fee)})`,
    );
  const receiver = receiverRow && receiverRow.isActive && receiverRow.isApproved ? receiverRow : null;
  if (!receiver) errors.push('Invalid receiver selected');
  if (errors.length) throw new ValidationError(errors);

  // 6. ML score.
  const hour = hourInDar(now);
  const features = buildFeatures({
    amount: c.amount,
    hour,
    balance,
    accountCreatedAt: sender.createdAt,
    now,
    ctx,
  });
  const { result: ml } = await scoreWithMl(d.ml, features);

  // 7. Rule overrides.
  const outcome = applyTransferRules({ amount: c.amount, balance, hour, locationScore: locScore, ctx }, ml);
  const scored: NewTransaction = {
    ...row,
    fraudScore: outcome.fraudScore,
    fraudPrediction: outcome.fraudPrediction,
    riskLevel: outcome.riskLevel,
    predictionTime: ml.predictionTime,
    modelVersion: ml.modelVersion,
    featureData: { ...features },
  };

  // 8. Commit.
  const result = await d.db.transaction(async (tx): Promise<TransferResult> => {
    if (outcome.block) {
      const reason = outcome.blockReason ?? 'Fraud detected';
      const inserted = await insertTransaction(tx, { ...scored, status: 'ABORTED', message: `BLOCKED: ${reason} | ${message}` });
      return {
        outcome: 'blocked',
        reason,
        message: BLOCKED_TEXT('Transaction', reason, outcome.fraudScore, outcome.riskLevel),
        riskScore: outcome.fraudScore,
        riskLevel: outcome.riskLevel,
        transactionId: inserted.transactionId,
        ...(warning && { locationWarning: warning }),
      };
    }

    if (!(await debitBalance(tx, sender.id, total))) {
      throw new HttpError(409, 'DEBIT_FAILED', 'Failed to deduct balance');
    }
    await creditBalance(tx, receiver!.id, c.amount);
    await updateUserLocation(tx, sender.id, location, c.coordinates);
    const inserted = await insertTransaction(tx, { ...scored, status: 'SUCCESS', message: message || null });

    return {
      outcome: 'success',
      message: `Transaction successful! You sent ${formatTsh(c.amount)} to ${receiver!.fullName}`,
      transactionId: inserted.transactionId,
      newBalance: Math.round((balance - total) * 100) / 100,
      riskScore: outcome.fraudScore,
      riskLevel: outcome.riskLevel,
      fraudPrediction: outcome.fraudPrediction,
      createdAt: inserted.createdAt.toISOString(),
      flaggedForReview: isFlaggedForReview(outcome.fraudScore),
      ...(warning && { locationWarning: warning }),
    };
  });

  // 9. Notify both parties after the money has moved and the row is committed.
  if (result.outcome === 'success') {
    const notice = {
      senderName: sender.fullName,
      senderPhone: sender.phone,
      senderBalance: result.newBalance,
      receiverName: receiver!.fullName,
      receiverPhone: receiver!.phone,
      receiverBalance: Math.round((num(receiver!.balance) + c.amount) * 100) / 100,
      amount: c.amount,
      reference: result.transactionId,
    };
    void notifyTransferSent(d.sms, notice).catch(() => undefined);
    void notifyTransferReceived(d.sms, notice).catch(() => undefined);
  } else if (result.outcome === 'blocked') {
    void notifyTransactionBlocked(d.sms, {
      phone: sender.phone,
      kind: 'transfer',
      reason: result.reason,
      reference: result.transactionId,
    }).catch(() => undefined);
  }

  return result;
}
