import { useLanguage, translate as tr } from '../../i18n';
export interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  useLanguage();
  if (totalPages <= 1) return null;
  const current = Math.max(1, Math.min(page, totalPages));
  const pages = new Set([1, totalPages]);
  for (let n = Math.max(1, current - 2); n <= Math.min(totalPages, current + 2); n++) pages.add(n);
  const sorted = [...pages].sort((a, b) => a - b);
  return (
    <nav aria-label={tr('Pagination')} className="pagination flex flex-wrap items-center gap-1.5">
      <button type="button" disabled={current === 1} onClick={() => onChange(current - 1)}>
        {tr('Previous')}
      </button>
      {sorted.map((n, index) => (
        <span key={n} className="contents">
          {index > 0 && n - sorted[index - 1]! > 1 && <span aria-hidden="true">…</span>}
          <button
            type="button"
            aria-label={tr(`Page ${n}`)}
            aria-current={n === current ? 'page' : undefined}
            disabled={n === current}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        </span>
      ))}
      <button type="button" disabled={current === totalPages} onClick={() => onChange(current + 1)}>
        {tr('Next')}
      </button>
    </nav>
  );
}
