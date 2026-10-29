import { FRAUD } from '@fraud/shared';
import { formatTsh } from '../../lib/money';

/** Velocity counters for the sender (and the chosen receiver) at the moment of a transaction. */
export interface VelocityContext {
  transactionCountLast5Min: number;
  amountLast5Min: number;
  largeCountLast5Min: number;
  largeSumLast5Min: number;
  uniqueReceiversLast5Min: number;
  receiverAlreadyInWindow: boolean;
  uniqueSendersToReceiverLast7Min: number;
  senderAlreadyInReceiverWindow: boolean;
  /** Distinct senders who sent to this user in the last 5 minutes (ML feature). */
  uniqueSendersLast5Min: number;
  failedWithdrawalsLast10Min: number;
  avgUserAmount: number;
}

export interface PatternBlock {
  pattern: 1 | 2 | 3;
  score: 85 | 90;
  /** Stored in transactions.message. */
  dbMessage: string;
  /** Shown to the customer. */
  userMessage: string;
}

const WAIT = 'Please wait a few minutes before sending again.';

/** Pattern 1: three or more large (>1M) transactions totalling more than 10M within 5 minutes. */
export function checkLargeVolume(
  amount: number,
  ctx: VelocityContext,
  userMessage = '',
): PatternBlock | null {
  const isLarge = amount > FRAUD.LARGE_TX_THRESHOLD;
  const newCount = ctx.largeCountLast5Min + (isLarge ? 1 : 0);
  const newSum = ctx.largeSumLast5Min + (isLarge ? amount : 0);
  if (newCount >= FRAUD.LARGE_VOLUME_MAX_COUNT && newSum > FRAUD.LARGE_VOLUME_MAX_SUM) {
    return {
      pattern: 1,
      score: 85,
      dbMessage: `BLOCKED: Large transaction volume - ${newCount} large transactions totaling ${formatTsh(newSum)} in 5 minutes (max: 3, 10M) | ${userMessage}`,
      userMessage:
        `You have made ${newCount} large transactions totaling ${formatTsh(newSum)} in the last 5 minutes.\n` +
        `Maximum allowed: 3 large transactions totaling 10,000,000 TSh per 5 minutes.\n\n${WAIT}`,
    };
  }
  return null;
}

/** Pattern 2: the sender would reach 4 distinct receivers within 5 minutes. */
export function checkManyReceivers(ctx: VelocityContext, userMessage = ''): PatternBlock | null {
  const unique = ctx.uniqueReceiversLast5Min;
  const newCount = unique + (ctx.receiverAlreadyInWindow ? 0 : 1);
  if (newCount >= FRAUD.MANY_RECEIVERS_BLOCK_AT) {
    return {
      pattern: 2,
      score: 90,
      dbMessage: `BLOCKED: User has ${unique} unique receivers in 5 minutes. Attempting to send to ${newCount} (max: 4) | ${userMessage}`,
      userMessage:
        `You have sent money to ${unique} different recipients in the last 5 minutes.\n` +
        `Maximum allowed: ${FRAUD.MANY_RECEIVERS_BLOCK_AT - 1} recipients per 5 minutes.\n\n${WAIT}`,
    };
  }
  return null;
}

/** Pattern 3: the receiver would reach 3 distinct senders within 7 minutes. */
export function checkManySenders(ctx: VelocityContext, userMessage = ''): PatternBlock | null {
  const unique = ctx.uniqueSendersToReceiverLast7Min;
  const newCount = unique + (ctx.senderAlreadyInReceiverWindow ? 0 : 1);
  if (newCount >= FRAUD.MANY_SENDERS_BLOCK_AT) {
    return {
      pattern: 3,
      score: 90,
      dbMessage: `BLOCKED: Receiver has ${unique} unique senders in 7 minutes. Attempting to receive from ${newCount} (max: 3) | ${userMessage}`,
      userMessage:
        `The recipient has received money from ${unique} different senders in the last 7 minutes.\n` +
        `Maximum allowed: ${FRAUD.MANY_SENDERS_BLOCK_AT - 1} senders per 7 minutes.\n\n${WAIT}`,
    };
  }
  return null;
}
