import { getLocale } from '../i18n';

export function formatTsh(n: number): string {
  return `TSh ${new Intl.NumberFormat(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

export function formatDate(iso: string, style: 'date' | 'minute' | 'second' | 'long'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'N/A';
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Africa/Dar_es_Salaam',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  if (style !== 'date')
    Object.assign(options, { hour: '2-digit', minute: '2-digit', hour12: true });
  if (style === 'second' || style === 'long') options.second = '2-digit';
  if (style === 'long') Object.assign(options, { weekday: 'long', month: 'long' });
  return new Intl.DateTimeFormat(getLocale(), options).format(date);
}

export function riskColor(score: number): string {
  return score > 70 ? '#ef4444' : score > 40 ? '#f59e0b' : '#10b981';
}

export function maskCard(card: string): string {
  return `****${card.replace(/\s/g, '').slice(-4)}`;
}
