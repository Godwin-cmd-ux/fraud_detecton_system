import { expect, it } from 'vitest';
import type { AdjustmentLogRow } from '../../../api/types';
import { adjustmentsCsv } from './BalanceAdjustments';

it('exports only supplied rows and escapes quotes, commas, newlines and spreadsheet formulas', () => {
  const row: AdjustmentLogRow = {
    id: 1,
    transactionId: 'TXN1',
    amount: 100,
    type: 'deposit',
    reason: '=HYPERLINK("x")\nsecond,line',
    createdAt: '2026-10-29',
    userId: 2,
    userName: 'Amina',
    userEmail: 'a@x',
    adminId: null,
    adminName: null,
    adminUsername: null,
    ipAddress: null,
  };
  const csv = adjustmentsCsv([row]);
  expect(csv).toContain('"System"');
  expect(csv).toContain('"\'=HYPERLINK(""x"")\nsecond;line"');
  expect(csv).toContain('"TXN1"');
  expect(adjustmentsCsv([]).split('\r\n')).toHaveLength(1);
});
