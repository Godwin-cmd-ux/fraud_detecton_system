/** Converts a Postgres numeric (string) or number to a JS number; null becomes 0. */
export function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Two-decimal string for numeric columns. */
export function money(v: number): string {
  return v.toFixed(2);
}

const tsh = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatTsh(v: number): string {
  return `TSh ${tsh.format(v)}`;
}
