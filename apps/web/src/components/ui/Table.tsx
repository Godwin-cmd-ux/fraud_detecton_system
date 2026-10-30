import { useLanguage, translate as tr } from '../../i18n';
import type { ReactNode } from 'react';
import { DisplayIcon } from './DisplayIcon';

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
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-p-border px-5 py-4">
          {title && (
            <h2 className="text-base font-semibold text-p-dark">
              {tr(typeof title === 'string' ? title.replace(/^[^\p{L}\p{N}]+/u, '') : title)}
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
    <div className="w-full overflow-x-auto">
      <table className={`w-full border-collapse text-sm ${className}`}>{children}</table>
    </div>
  );
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  useLanguage();
  return (
    <th
      className={`border-b border-p-border bg-p-bg px-3 py-2.5 text-left text-xs font-bold tracking-wide text-p-muted uppercase ${className}`}
    >
      {tr(children)}
    </th>
  );
}

export function Td({
  children,
  className = '',
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  useLanguage();
  return (
    <td
      colSpan={colSpan}
      className={`border-b border-p-border px-3 py-4 align-middle ${className}`}
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
    <div className="px-3 py-14 text-center text-p-muted">
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-p-border bg-p-bg">
          <DisplayIcon value={icon} size={22} />
        </div>
      )}
      <div className="text-base font-semibold text-p-text">{tr(title)}</div>
      {children && <div className="mt-1 text-sm">{tr(children)}</div>}
    </div>
  );
}
