import { afterEach, describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import type { TransactionListItem } from '@fraud/shared';
import { setLanguage } from '../i18n';
import { buildReceipt, receiptFileName, securityCheck } from './receipt';

const tx = (patch: Partial<TransactionListItem> = {}): TransactionListItem => ({
  id: 1,
  transactionId: 'TXN20261030ABC',
  type: 'transfer',
  direction: 'sent',
  counterpartyName: 'Baraka Mushi',
  amount: 125_000,
  status: 'SUCCESS',
  fraudScore: 12,
  fraudPrediction: 'LEGIT',
  riskLevel: 'LOW',
  message: '✅ Rent for October',
  location: 'Arusha',
  createdAt: '2026-10-30T09:15:00Z',
  ...patch,
});

/** Uncompressed PDF text operators keep the strings readable in the raw output. */
const pdfText = (t: TransactionListItem) =>
  buildReceipt(jsPDF, t, { name: 'Amina Hassan', email: 'amina@example.com' }).output();

afterEach(() => setLanguage('en'));

describe('transaction receipt', () => {
  it('writes the transaction details into the PDF', () => {
    const out = pdfText(tx());
    expect(out.startsWith('%PDF-')).toBe(true);
    for (const text of [
      'TXN20261030ABC',
      'TSh 125,000.00',
      'Sent to Baraka Mushi',
      'Arusha',
      'Amina Hassan',
      'Rent for October',
      'Passed',
    ]) {
      expect(out).toContain(text);
    }
    expect(out).not.toContain('✅');
  });

  it('follows the selected language', () => {
    setLanguage('sw');
    const out = pdfText(tx());
    expect(out).toContain('Risiti ya muamala');
    expect(out).toContain('Imetumwa kwa Baraka Mushi');
  });

  it('describes the fraud screening outcome', () => {
    expect(securityCheck(tx()).title).toBe('Passed');
    expect(securityCheck(tx({ fraudScore: 55 })).title).toBe('Flagged for review');
    expect(
      securityCheck(tx({ status: 'ABORTED', fraudPrediction: 'FRAUD', fraudScore: 90 })).title,
    ).toBe('Blocked by fraud checks');
    expect(securityCheck(tx({ fraudPrediction: null, fraudScore: 0 })).title).toBe(
      'Not yet analysed',
    );
    // A transfer can succeed while the model predicts fraud; it is reviewed, not blocked.
    expect(securityCheck(tx({ fraudPrediction: 'FRAUD', fraudScore: 95 })).title).toBe(
      'Flagged for review',
    );
  });

  it('names the file after the transaction', () => {
    expect(receiptFileName(tx())).toBe('sentinel-receipt-TXN20261030ABC.pdf');
  });
});
