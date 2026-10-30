import type { Location, RiskLevel, TransferResult } from '@fraud/shared';
import type { Db } from '../../db/client';
import { HttpError, ValidationError } from '../../lib/errors';
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
import { findActiveUserById, findUserById, updateUserLocation } from '../users/repo';
import type { UserRow } from '../users/repo';
import { creditBalance, debitBalance, insertTransaction } from './repo';
import type { NewTransaction } from './repo';

export interface TransferDeps {
  db: Db;
  ml: MlClient;
  now: () => Date;
}

export interface TransferCommand {
  userId: number;
  receiverId: number;
  amount: number;
  location: Location;
  message?: string;
  ip: string | null;
  userAgent: string | null;
}

export const BLOCKED_TEXT = (kind: 'Transaction' | 'Withdrawal', reason: string, score: number, level: RiskLevel) =>
  `❌ ${kind} BLOCKED due to fraud detection.\n\nReason: ${reason}\nRisk Score: ${score}%\nRisk Level: ${level}\n\nPlease contact support if you believe this is a mistake.`;

/** Fields shared by every transfer row written by this pipeline. */
function baseRow(c: TransferCommand, sender: UserRow, receiverName: string, now: Date): NewTransaction {
  return {
    transactionId: newTransactionId(now),
    senderId: sender.id,
    receiverId: c.receiverId,
    senderName: sender.fullName,
    receiverName,
    amount: c.amount,
    transactionType: 'transfer',
    status: 'ABORTED',
    message: null,
    fraudScore: 0,
    fraudPrediction: null,
    riskLevel: null,
    predictionTime: null,
    modelVersion: null,
    featureData: null,
    transactionLocation: c.location,
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

  const receiverRow = c.receiverId > 0 ? await findUserById(d.db, c.receiverId) : null;
  const receiverName = receiverRow?.fullName ?? 'Unknown';
  const message = c.message ?? '';
  const ctx: VelocityContext = await getVelocityContext(d.db, {
    senderId: sender.id,
    receiverId: c.receiverId,
    now,
  });
  const row = baseRow(c, sender, receiverName, now);

  // 1-3. Velocity patterns, first block wins.
  const pattern =
    checkLargeVolume(c.amount, ctx, message) ??
    checkManyReceivers(ctx, message) ??
    checkManySenders(ctx, message);
  if (pattern) return recordPatternBlock(d.db, row, pattern);

  // 4. Location.
  const change = await getLocationChange(d.db, { userId: sender.id, newLocation: c.location, now });
  const locScore = locationScore(change);
  const warning = locationWarning(change);

  // 5. Validation (writes nothing).
  const balance = num(sender.balance);
  const errors: string[] = [];
  if (c.receiverId <= 0) errors.push('Please select a receiver');
  if (c.receiverId === sender.id) errors.push('You cannot send money to yourself');
  if (c.amount <= 0) errors.push('Amount must be greater than 0');
  if (c.amount > balance) errors.push(`Insufficient balance. Your balance is ${formatTsh(balance)}`);
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
  return d.db.transaction(async (tx) => {
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

    if (!(await debitBalance(tx, sender.id, c.amount))) {
      throw new HttpError(409, 'DEBIT_FAILED', 'Failed to deduct balance');
    }
    await creditBalance(tx, receiver!.id, c.amount);
    await updateUserLocation(tx, sender.id, c.location);
    const inserted = await insertTransaction(tx, { ...scored, status: 'SUCCESS', message: message || null });

    return {
      outcome: 'success',
      message: `Transaction successful! You sent ${formatTsh(c.amount)} to ${receiver!.fullName}`,
      transactionId: inserted.transactionId,
      newBalance: Math.round((balance - c.amount) * 100) / 100,
      riskScore: outcome.fraudScore,
      riskLevel: outcome.riskLevel,
      fraudPrediction: outcome.fraudPrediction,
      createdAt: inserted.createdAt.toISOString(),
      flaggedForReview: isFlaggedForReview(outcome.fraudScore),
      ...(warning && { locationWarning: warning }),
    };
  });
}
