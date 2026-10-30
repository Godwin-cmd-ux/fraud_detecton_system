/**
 * Screen formatting for USSD. The gateway caps a response at 182 characters, so every screen is
 * built from short lines and passed through `fit` before it leaves the service.
 */

export const MAX_USSD_CHARS = 182;

const amountFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const money = (value: number): string => `TSh ${amountFormatter.format(value)}`;

/** Bare figure for list rows where the currency is implied by the screen header. */
export const amount = (value: number): string => amountFormatter.format(value);

/** Short figures for dashboards: 12500 -> 12.5K, 2400000 -> 2.4M. */
export function compact(value: number): string {
  if (value >= 1_000_000) return `${Math.round((value / 1_000_000) * 10) / 10}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

/** `30/10 14:05` in Dar es Salaam time, short enough for a list row. */
export function shortDate(d: Date): string {
  const s = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Dar_es_Salaam',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
  return s.replace(',', '');
}

/** `YYYY-MM-DD` in Dar es Salaam time. */
export function dayOnly(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dar_es_Salaam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export const titleCase = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1).toLowerCase() : s);

export const firstName = (full: string): string => full.trim().split(/\s+/)[0] ?? full;

/** Trims a screen to the gateway limit without cutting a number or line in half. */
export function fit(text: string, max = MAX_USSD_CHARS): string {
  const body = text.replace(/\n{3,}/g, '\n\n').trim();
  if (body.length <= max) return body;
  const cut = body.slice(0, max - 1);
  const lastLine = cut.lastIndexOf('\n');
  return `${lastLine > 40 ? cut.slice(0, lastLine) : cut}…`;
}

export const con = (text: string): string => `CON ${text}`;
export const end = (text: string): string => `END ${text}`;

/** Celebration-free status words; USSD screens stay plain and readable. */
export const STATUS_LABEL: Record<string, string> = {
  SUCCESS: 'OK',
  ABORTED: 'FAILED',
  PENDING: 'PENDING',
};

/** `SENT 5,000 OK` — one transaction row, short enough for four per screen. */
export function txLine(index: number, direction: string, value: number, status: string): string {
  return `${index}.${direction} ${amount(value)} ${STATUS_LABEL[status] ?? status}`;
}
