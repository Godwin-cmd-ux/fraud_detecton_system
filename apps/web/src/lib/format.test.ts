import { describe, expect, it } from 'vitest';
import { formatDate, formatTsh, maskCard, riskColor } from './format';

describe('display formatting', () => {
  it('formats shillings with separators and two decimal places', () => {
    expect(formatTsh(1234.5)).toBe('TSh 1,234.50');
    expect(formatTsh(0)).toBe('TSh 0.00');
  });
  it('preserves fraud score color boundaries', () => {
    expect(riskColor(71)).toBe('#ef4444');
    expect(riskColor(70)).toBe('#f59e0b');
    expect(riskColor(41)).toBe('#f59e0b');
    expect(riskColor(40)).toBe('#10b981');
  });
  it('shows only the last four card digits', () => {
    expect(maskCard('1234567812345678')).toBe('****5678');
    expect(maskCard('1234 5678 1234 5678')).toBe('****5678');
  });
  it('uses Dar es Salaam time across a UTC date boundary', () => {
    expect(formatDate('2026-10-29T22:00:00Z', 'date')).toBe('Oct 30, 2026');
    expect(formatDate('2026-10-29T22:00:00Z', 'second')).toContain('01:00:00 AM');
    expect(formatDate('invalid', 'date')).toBe('N/A');
  });
});
