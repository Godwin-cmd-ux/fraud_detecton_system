import { useLanguage, translate as tr } from '../../i18n';
import type { ReactNode } from 'react';
import { DisplayIcon } from './DisplayIcon';
import { plainText } from '../../lib/text';

export function Card({
  title,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  useLanguage();
  return (
    <section
      className={`surface-card overflow-hidden rounded-card border border-p-border bg-white ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-p-border px-5 py-3.5">
          {title && (
            <h2 className="text-[15px] font-semibold tracking-tight text-p-dark">
              {tr(plainText(title))}
            </h2>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  useLanguage();
  return (
    <div className="-mx-5 w-[calc(100%+2.5rem)] overflow-x-auto px-5">
      <table className={`w-full border-collapse text-sm ${className}`}>{children}</table>
    </div>
  );
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  useLanguage();
  return (
    <th
      className={`border-b border-p-border px-3 py-2.5 text-left text-[11px] font-semibold tracking-[0.08em] text-p-muted uppercase ${className}`}
    >
      {tr(children)}
    </th>
  );
}

export function Td({
  children,
  className = '',
  colSpan,
  label,
}: {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
  /** Column name shown beside the value when a `.table-cards` table collapses to cards. */
  label?: string;
}) {
  useLanguage();
  return (
    <td
      colSpan={colSpan}
      data-label={label ? tr(label) : undefined}
      className={`border-b border-[#eceee8] px-3 py-3.5 align-middle whitespace-nowrap ${className}`}
    >
      {children}
    </td>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  useLanguage();
  return (
    <div className="animate-slide-down px-3 py-14 text-center text-p-muted">
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-p-border bg-p-bg text-p-muted">
          <DisplayIcon value={icon} size={22} />
        </div>
      )}
      <div className="text-base font-semibold text-p-text">{tr(title)}</div>
      {children && <div className="mt-1 text-sm">{tr(children)}</div>}
    </div>
  );
}
