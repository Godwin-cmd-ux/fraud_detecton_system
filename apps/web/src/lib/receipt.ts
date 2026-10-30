import type { jsPDF as JsPdf } from 'jspdf';
import { FRAUD } from '@fraud/shared';
import type { TransactionListItem, TransferResult } from '@fraud/shared';
import { translate as tr } from '../i18n';
import { describeTransaction } from './transactions';
import { formatDate, formatTsh } from './format';
import { plainText } from './text';

export interface ReceiptHolder {
  name: string;
  email?: string;
}

type Tone = 'ok' | 'warn' | 'risk' | 'muted';

/** Same palette as the app: green passed, amber review, red blocked. RGB for jsPDF. */
const TONES: Record<Tone, { ink: [number, number, number]; soft: [number, number, number] }> = {
  ok: { ink: [29, 117, 80], soft: [228, 241, 233] },
  warn: { ink: [149, 96, 15], soft: [248, 238, 219] },
  risk: { ink: [180, 56, 61], soft: [249, 229, 228] },
  muted: { ink: [102, 118, 111], soft: [238, 240, 235] },
};
const PINE: [number, number, number] = [14, 42, 44];
const SAGE: [number, number, number] = [179, 220, 192];
const INK: [number, number, number] = [20, 46, 43];
const MUTED: [number, number, number] = [102, 118, 111];
const LINE: [number, number, number] = [225, 229, 221];

/** What the customer should understand about the fraud screening of this transaction. */
export function securityCheck(t: TransactionListItem): { tone: Tone; title: string; body: string } {
  // Only an aborted transaction was blocked; a successful one the model scored as fraud
  // went through and is reviewed instead (as the API's own tests show).
  if (t.status === 'ABORTED') {
    return {
      tone: 'risk',
      title: 'Blocked by fraud checks',
      body: 'No money moved. Contact support if you believe this is a mistake.',
    };
  }
  if (
    t.fraudPrediction === 'FRAUD' ||
    (t.fraudScore > FRAUD.FLAG_REVIEW_MIN_EXCLUSIVE &&
      t.fraudScore <= FRAUD.FLAG_REVIEW_MAX_INCLUSIVE)
  ) {
    return {
      tone: 'warn',
      title: 'Flagged for review',
      body: 'The transaction went through and an administrator will review it.',
    };
  }
  if (!t.fraudPrediction || t.fraudPrediction === 'PENDING') {
    return {
      tone: 'muted',
      title: 'Not yet analysed',
      body: 'Fraud screening for this transaction has not finished.',
    };
  }
  return { tone: 'ok', title: 'Passed', body: 'This transaction passed all fraud checks.' };
}

const statusTone = (status: TransactionListItem['status']): Tone =>
  status === 'SUCCESS' ? 'ok' : status === 'ABORTED' ? 'risk' : 'warn';

export function receiptFileName(t: TransactionListItem): string {
  return `sentinel-receipt-${t.transactionId.replace(/[^\w-]+/g, '')}.pdf`;
}

/** Lays out an A5 receipt. Text goes through `tr`, so it follows the current language. */
export function buildReceipt(
  JsPDF: typeof JsPdf,
  t: TransactionListItem,
  holder: ReceiptHolder,
  now: Date = new Date(),
): JsPdf {
  const doc = new JsPDF({ unit: 'mm', format: 'a5', compress: false });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const left = 14;
  const right = width - 14;
  doc.setProperties({
    title: `${tr('Transaction receipt')} ${t.transactionId}`,
    creator: 'Sentinel',
  });

  // Header band
  doc.setFillColor(...PINE);
  doc.rect(0, 0, width, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Sentinel', left, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SAGE);
  doc.text(tr('Transaction receipt'), left, 23);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(t.transactionId, right, 16, { align: 'right' });

  // Amount and status
  let y = 50;
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.text(tr('Amount').toUpperCase(), left, y);
  y += 10;
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(formatTsh(t.amount), left, y);

  const status = tr(t.status);
  const tone = TONES[statusTone(t.status)];
  doc.setFontSize(8);
  const pillWidth = doc.getTextWidth(status) + 8;
  doc.setFillColor(...tone.soft);
  doc.roundedRect(right - pillWidth, y - 6.5, pillWidth, 8, 2, 2, 'F');
  doc.setTextColor(...tone.ink);
  doc.text(status, right - pillWidth / 2, y - 1.3, { align: 'center' });

  // Detail rows
  y += 10;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(left, y, right, y);
  const rows: [string, string][] = [
    ['Transaction ID', t.transactionId],
    ['Date & Time', `${formatDate(t.createdAt, 'second')} (EAT)`],
    ['Type', tr(describeTransaction(t))],
    ...(t.location ? ([['Location', t.location]] as [string, string][]) : []),
    ['Account holder', holder.email ? `${holder.name} · ${holder.email}` : holder.name],
  ];
  if (t.message) rows.push(['Message', plainText(t.message)]);
  doc.setFontSize(9);
  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(tr(label), left, y + 7);
    doc.setTextColor(...INK);
    const lines: string[] = doc.splitTextToSize(value, right - left - 38);
    doc.text(lines, right, y + 7, { align: 'right' });
    y += 5 + lines.length * 4.4;
    doc.line(left, y, right, y);
  }

  // Security check
  const check = securityCheck(t);
  const checkTone = TONES[check.tone];
  y += 8;
  const bodyLines: string[] = doc.splitTextToSize(tr(check.body), right - left - 10);
  const boxHeight = 13 + bodyLines.length * 4.2;
  doc.setFillColor(...checkTone.soft);
  doc.roundedRect(left, y, right - left, boxHeight, 3, 3, 'F');
  doc.setTextColor(...checkTone.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(tr('Security check').toUpperCase(), left + 5, y + 6.5);
  doc.setFontSize(10);
  doc.text(tr(check.title), right - 5, y + 6.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(bodyLines, left + 5, y + 12.5);

  // Footer
  doc.setDrawColor(...LINE);
  doc.line(left, height - 22, right, height - 22);
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(tr(`Generated on ${formatDate(now.toISOString(), 'second')} (EAT)`), left, height - 15);
  doc.text(
    doc.splitTextToSize(
      tr('This receipt reflects your account records at the time it was generated.'),
      right - left,
    ),
    left,
    height - 10.5,
  );
  return doc;
}

type SuccessResult = Extract<TransferResult, { outcome: 'success' }>;

/**
 * Builds the receipt record for a transfer or withdrawal that just succeeded, from the
 * server's result (ID, time, score, prediction) and the details the customer submitted.
 */
export function receiptFromResult(
  result: SuccessResult,
  submitted: {
    direction: 'sent' | 'withdrawal';
    amount: number;
    counterpartyName?: string | null;
    location: string;
    message?: string;
  },
): TransactionListItem {
  return {
    id: 0,
    transactionId: result.transactionId,
    type: submitted.direction === 'withdrawal' ? 'withdrawal' : 'transfer',
    direction: submitted.direction,
    counterpartyName: submitted.counterpartyName ?? null,
    amount: submitted.amount,
    status: 'SUCCESS',
    fraudScore: result.riskScore,
    fraudPrediction: result.fraudPrediction,
    riskLevel: result.riskLevel,
    message: submitted.message || null,
    location: submitted.location,
    createdAt: result.createdAt,
  };
}

/** Loads jsPDF on demand (it is large) and saves the receipt as a file. */
export async function downloadReceipt(t: TransactionListItem, holder: ReceiptHolder) {
  const { jsPDF } = await import('jspdf');
  buildReceipt(jsPDF, t, holder).save(receiptFileName(t));
}
