import { describe, expect, it } from 'vitest';
import { daysBetween, hourInDar, minutesAgo } from '../../src/lib/time';
import { newTransactionId } from '../../src/lib/ids';
import { formatTsh, num } from '../../src/lib/money';

describe('hourInDar', () => {
  it('converts UTC to East Africa Time (UTC+3)', () => {
    expect(hourInDar(new Date('2026-10-29T02:30:00Z'))).toBe(5);
    expect(hourInDar(new Date('2026-10-29T03:00:00Z'))).toBe(6);
    expect(hourInDar(new Date('2026-10-29T22:00:00Z'))).toBe(1);
  });
});

describe('minutesAgo / daysBetween', () => {
  it('subtracts minutes and counts whole days', () => {
    const now = new Date('2026-10-29T12:00:00Z');
    expect(minutesAgo(now, 5).toISOString()).toBe('2026-10-29T11:55:00.000Z');
    expect(daysBetween(new Date('2026-10-19T13:00:00Z'), now)).toBe(9);
    expect(daysBetween(new Date('2026-10-19T11:00:00Z'), now)).toBe(10);
  });
});

describe('newTransactionId', () => {
  it('uses TXN + Dar es Salaam timestamp + four digits', () => {
    expect(newTransactionId(new Date('2026-10-29T10:00:00Z'), () => 0)).toBe('TXN202610291300001000');
    expect(newTransactionId(new Date())).toMatch(/^TXN\d{14}\d{4}$/);
  });
});

describe('money helpers', () => {
  it('parses numeric strings and formats TSh', () => {
    expect(num('1234.50')).toBe(1234.5);
    expect(num(null)).toBe(0);
    expect(formatTsh(1234.5)).toBe('TSh 1,234.50');
    expect(formatTsh(10_500_000)).toBe('TSh 10,500,000.00');
  });
});
