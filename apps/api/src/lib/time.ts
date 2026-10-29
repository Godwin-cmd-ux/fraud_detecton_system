import { TIMEZONE } from '@fraud/shared';

const hourFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  hour: 'numeric',
  hourCycle: 'h23',
});

/** Hour of day (0-23) in Africa/Dar_es_Salaam. */
export function hourInDar(d: Date): number {
  return Number(hourFormatter.format(d));
}

export function minutesAgo(now: Date, m: number): Date {
  return new Date(now.getTime() - m * 60_000);
}

export function hoursAgo(now: Date, h: number): Date {
  return new Date(now.getTime() - h * 3_600_000);
}

/** Whole days from `a` to `b` (floored, never negative). */
export function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86_400_000));
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** `yyyyMMddHHmmss` in Dar es Salaam time. */
export function darStamp(d: Date): string {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(d).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

/** `YYYY-MM-DD` in Dar es Salaam time. */
export function darDate(d: Date): string {
  const s = darStamp(d);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}
