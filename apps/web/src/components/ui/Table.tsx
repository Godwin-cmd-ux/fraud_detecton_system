import type { ReactNode } from 'react';

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-card border border-p-border bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-p-border px-5 py-4">
          {title && <h2 className="text-base font-bold text-p-dark">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full border-collapse text-sm ${className}`}>{children}</table>
    </div>
  );
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <th className={`border-b border-p-border bg-p-bg px-3 py-2.5 text-left text-xs font-bold tracking-wide text-p-muted uppercase ${className}`}>{children}</th>;
}

export function Td({ children, className = '', colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`border-b border-p-border px-3 py-2.5 align-middle ${className}`}>{children}</td>;
}

export function EmptyState({ icon, title, children }: { icon?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="py-10 text-center text-p-muted">
      {icon && <div className="mb-2 text-4xl">{icon}</div>}
      <div className="text-base font-semibold text-p-text">{title}</div>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  );
}
