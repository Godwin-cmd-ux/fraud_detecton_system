import type { jsPDF as JsPdf } from 'jspdf';
import { FRAUD } from '@fraud/shared';
import type { TransactionListItem, TransferResult } from '@fraud/shared';
import type { AdminTxDetails, PartyInfo } from '../api/types';
import { translate as tr } from '../i18n';
import { describeTransaction } from './transactions';
import { formatDate, formatTsh } from './format';
import { plainText } from './text';

export interface ReceiptHolder {
  name: string;
  email?: string;
}

type Tone = 'ok' | 'warn' | 'risk' | 'muted';
type Audience = 'customer' | 'admin';
type Screened = Pick<TransactionListItem, 'status' | 'fraudScore' | 'fraudPrediction'>;

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

/**
 * Outcome of fraud screening, worded for the reader. Only an aborted transaction was
 * blocked; one that succeeded while the model predicted fraud went through and is
 * reviewed instead (as the API's own tests show).
 */
export function securityCheck(
  t: Screened & { reviewedAt?: string | null },
  audience: Audience = 'customer',
): { tone: Tone; title: string; body: string } {
  if (t.status === 'ABORTED') {
    return {
      tone: 'risk',
      title: 'Blocked by fraud checks',
      body:
        audience === 'admin'
          ? 'The transaction was stopped and no money moved.'
          : 'No money moved. Contact support if you believe this is a mistake.',
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
      body:
        audience === 'admin'
          ? t.reviewedAt
            ? 'An administrator has reviewed this transaction.'
            : 'This transaction still needs an administrator review.'
          : 'The transaction went through and an administrator will review it.',
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

const cleanId = (id: string) => id.replace(/[^\w-]+/g, '');

export function receiptFileName(t: Pick<TransactionListItem, 'transactionId'>): string {
  return `sentinel-receipt-${cleanId(t.transactionId)}.pdf`;
}

export function adminRecordFileName(t: Pick<AdminTxDetails, 'transactionId'>): string {
  return `sentinel-record-${cleanId(t.transactionId)}.pdf`;
}

/** Everything the page layout needs; labels are English keys translated at render time. */
interface ReceiptContent {
  subtitle: string;
  transactionId: string;
  amount: number;
  status: TransactionListItem['status'];
  rows: [label: string, value: string][];
  check: { tone: Tone; title: string; body: string };
  footer: [generated: string, note: string];
}

/** Lays out an A5 receipt. Text goes through `tr`, so it follows the current language. */
function renderReceipt(JsPDF: typeof JsPdf, c: ReceiptContent): JsPdf {
  const doc = new JsPDF({ unit: 'mm', format: 'a5', compress: false });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const left = 14;
  const right = width - 14;
  doc.setProperties({ title: `${tr(c.subtitle)} ${c.transactionId}`, creator: 'Sentinel' });

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
  doc.text(tr(c.subtitle), left, 23);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(c.transactionId, right, 16, { align: 'right' });

  // Amount and status
  let y = 50;
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.text(tr('Amount').toUpperCase(), left, y);
  y += 10;
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(formatTsh(c.amount), left, y);

  const status = tr(c.status);
  const tone = TONES[statusTone(c.status)];
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
  doc.setFontSize(9);
  for (const [label, value] of c.rows) {
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
  const checkTone = TONES[c.check.tone];
  y += 8;
  const bodyLines: string[] = doc.splitTextToSize(tr(c.check.body), right - left - 10);
  const boxHeight = 13 + bodyLines.length * 4.2;
  doc.setFillColor(...checkTone.soft);
  doc.roundedRect(left, y, right - left, boxHeight, 3, 3, 'F');
  doc.setTextColor(...checkTone.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(tr('Security check').toUpperCase(), left + 5, y + 6.5);
  doc.setFontSize(10);
  doc.text(tr(c.check.title), right - 5, y + 6.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(bodyLines, left + 5, y + 12.5);

  // Footer
  doc.setDrawColor(...LINE);
  doc.line(left, height - 22, right, height - 22);
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(c.footer[0], left, height - 15);
  doc.text(doc.splitTextToSize(c.footer[1], right - left), left, height - 10.5);
  return doc;
}

const generatedAt = (now: Date) => formatDate(now.toISOString(), 'second');

/** The customer's receipt for one of their own transactions. */
export function buildReceipt(
  JsPDF: typeof JsPdf,
  t: TransactionListItem,
  holder: ReceiptHolder,
  now: Date = new Date(),
): JsPdf {
  const rows: [string, string][] = [
    ['Transaction ID', t.transactionId],
    ['Date & Time', `${formatDate(t.createdAt, 'second')} (EAT)`],
    ['Type', tr(describeTransaction(t))],
    ...(t.location ? ([['Location', t.location]] as [string, string][]) : []),
    ['Account holder', holder.email ? `${holder.name} · ${holder.email}` : holder.name],
  ];
  if (t.message) rows.push(['Message', plainText(t.message)]);
  return renderReceipt(JsPDF, {
    subtitle: 'Transaction receipt',
    transactionId: t.transactionId,
    amount: t.amount,
    status: t.status,
    rows,
    check: securityCheck(t),
    footer: [
      tr(`Generated on ${generatedAt(now)} (EAT)`),
      tr('This receipt reflects your account records at the time it was generated.'),
    ],
  });
}

const party = (p: PartyInfo | null) => (p ? `${p.fullName} · ${p.email}` : tr('N/A'));
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The administrator copy: both parties, the raw risk assessment and review status.
 * The stored message is shown as recorded, including any "BLOCKED: reason" prefix.
 */
export function buildAdminRecord(
  JsPDF: typeof JsPdf,
  tx: AdminTxDetails,
  preparedBy: string,
  now: Date = new Date(),
): JsPdf {
  const assessment = [
    `${tx.fraudScore.toFixed(1)}%`,
    tx.riskLevel ? tr(tx.riskLevel) : null,
    tx.fraudPrediction ? tr(tx.fraudPrediction) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const rows: [string, string][] = [
    ['Transaction ID', tx.transactionId],
    ['Date & Time', `${formatDate(tx.createdAt, 'second')} (EAT)`],
    ['Type', tr(capitalize(tx.type))],
    ['From', party(tx.sender)],
    ['To', party(tx.receiver)],
    ...(tx.location ? ([['Location', tx.location]] as [string, string][]) : []),
    ['Risk assessment', assessment],
    ...(tx.modelVersion ? ([['Model version', tx.modelVersion]] as [string, string][]) : []),
    ...(tx.reviewedAt
      ? ([['Reviewed', `${formatDate(tx.reviewedAt, 'second')} (EAT)`]] as [string, string][])
      : []),
  ];
  if (tx.message) rows.push(['Message', plainText(tx.message)]);
  return renderReceipt(JsPDF, {
    subtitle: 'Transaction record · administrator copy',
    transactionId: tx.transactionId,
    amount: tx.amount,
    status: tx.status,
    rows,
    check: securityCheck(tx, 'admin'),
    footer: [
      tr(`Generated on ${generatedAt(now)} (EAT) by ${preparedBy}`),
      tr('Internal record with personal data. Share only with authorised staff.'),
    ],
  });
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

export async function downloadAdminRecord(tx: AdminTxDetails, preparedBy: string) {
  const { jsPDF } = await import('jspdf');
  buildAdminRecord(jsPDF, tx, preparedBy).save(adminRecordFileName(tx));
}
