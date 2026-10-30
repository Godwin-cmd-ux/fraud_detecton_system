import { useLanguage, translate as tr } from '../../i18n';
import type { ReactNode } from 'react';
import { CalendarClock } from 'lucide-react';
import { useClock } from '../../lib/useClock';
import { plainText } from '../../lib/text';

export function TopHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  useLanguage();
  const clock = useClock();
  return (
    <header className="page-header mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="text-[1.75rem] font-semibold text-p-dark sm:text-3xl">
          {tr(plainText(title))}
        </h1>
        {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-p-muted">{tr(subtitle)}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {actions}
        <div className="tabular flex items-center gap-2 text-xs text-p-muted" data-testid="clock">
          <CalendarClock size={14} aria-hidden="true" />
          {clock}
        </div>
      </div>
    </header>
  );
}
