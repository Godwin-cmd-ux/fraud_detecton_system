import { formatTsh } from '../../lib/money';
import type { SmsSender } from './client';

/**
 * Customer-facing SMS notices.
 *
 * Each helper reads the number the database holds for the account and sends through the shared
 * `SmsClient`. Delivery is best-effort: the client returns `null` when SMS is disabled or the
 * gateway rejects the message, so a failed text never fails the wallet operation that caused it.
 * Call sites dispatch these after the database transaction has committed.
 */

export interface TransferNotice {
  senderName: string;
  senderPhone: string;
  senderBalance: number;
  receiverName: string;
  receiverPhone: string;
  receiverBalance: number;
  amount: number;
  reference: string;
}

export async function notifyTransferSent(sms: SmsSender | undefined, n: TransferNotice): Promise<void> {
  if (!sms) return;
  await sms.send({
    to: n.senderPhone,
    message: `You sent ${formatTsh(n.amount)} to ${n.receiverName}. Ref ${n.reference}. Balance ${formatTsh(n.senderBalance)}.`,
  });
}

export async function notifyTransferReceived(sms: SmsSender | undefined, n: TransferNotice): Promise<void> {
  if (!sms) return;
  await sms.send({
    to: n.receiverPhone,
    message: `You received ${formatTsh(n.amount)} from ${n.senderName}. Ref ${n.reference}. Balance ${formatTsh(n.receiverBalance)}.`,
  });
}

export interface WithdrawalNotice {
  userName: string;
  phone: string;
  amount: number;
  balance: number;
  reference: string;
}

export async function notifyWithdrawal(sms: SmsSender | undefined, n: WithdrawalNotice): Promise<void> {
  if (!sms) return;
  await sms.send({
    to: n.phone,
    message: `You withdrew ${formatTsh(n.amount)}. Ref ${n.reference}. Balance ${formatTsh(n.balance)}.`,
  });
}

export interface BlockedNotice {
  phone: string;
  kind: 'transfer' | 'withdrawal';
  reason: string;
  reference: string;
}

/** A fraud rule stopped the operation; no money moved, so the customer is told why. */
export async function notifyTransactionBlocked(sms: SmsSender | undefined, n: BlockedNotice): Promise<void> {
  if (!sms) return;
  const articles = n.kind === 'transfer' ? 'transfer' : 'withdrawal';
  await sms.send({
    to: n.phone,
    message: `Your ${articles} was blocked: ${n.reason}. Ref ${n.reference}. No money was moved.`,
  });
}

export interface AdjustmentNotice {
  phone: string;
  /** Money added or removed from the wallet. */
  amount: number;
  direction: 'credit' | 'debit';
  balance: number;
  reason?: string | null;
}

export async function notifyBalanceAdjustment(sms: SmsSender | undefined, n: AdjustmentNotice): Promise<void> {
  if (!sms) return;
  const verb = n.direction === 'credit' ? 'credited with' : 'debited by';
  const reason = n.reason?.trim() ? ` Reason: ${n.reason.trim()}` : '';
  await sms.send({
    to: n.phone,
    message: `Your account was ${verb} ${formatTsh(n.amount)} by the administrator. Balance ${formatTsh(n.balance)}.${reason}`,
  });
}
