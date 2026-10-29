import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';

export interface SidebarBadge {
  count: number;
  tone: 'info' | 'warning' | 'fraud' | 'plain';
}

export interface SidebarItem {
  to: string;
  label: string;
  icon: string;
  badge?: SidebarBadge;
  /** Match the active state on the path only (ignore the query string). */
  end?: boolean;
  onClick?: () => void;
}

const badgeTones: Record<SidebarBadge['tone'], string> = {
  info: 'bg-p-primary text-white',
  warning: 'bg-p-warning text-white',
  fraud: 'bg-p-danger text-white',
  plain: 'bg-white/15 text-white',
};

export interface SidebarShellProps {
  brand: string;
  subtitle: string;
  profile: { initial: string; name: string; role: string };
  items: SidebarItem[];
  footer?: ReactNode;
}

/** Fixed 280px dark sidebar with a hamburger below 768px, as the original layout. */
export function SidebarShell({ brand, subtitle, profile, items, footer }: SidebarShellProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="flex min-h-screen">
      <button
        type="button"
        className="no-print fixed top-3 left-3 z-40 rounded-lg bg-p-darker px-3 py-2 text-sm font-semibold text-white shadow md:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        ☰ Menu
      </button>
      {open && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-30 flex w-[280px] flex-col bg-gradient-to-b from-p-darker to-p-dark text-white transition-transform md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="border-b border-white/10 px-6 py-5">
          <div className="text-xl font-bold">{brand}</div>
          <div className="text-xs text-white/60">{subtitle}</div>
        </div>
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-p-primary text-lg font-bold">{profile.initial}</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{profile.name}</div>
            <div className="text-xs text-white/60">{profile.role}</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {items.map((item) => (
            <NavLink
              key={item.to + item.label}
              to={item.to}
              end={item.end}
              onClick={() => {
                setOpen(false);
                item.onClick?.();
              }}
              className={({ isActive }) =>
                `flex items-center justify-between gap-3 px-6 py-2.5 text-sm transition hover:bg-white/10 ${isActive && !item.onClick ? 'border-l-4 border-p-primary bg-white/10 font-semibold' : 'border-l-4 border-transparent'}`
              }
            >
              <span className="flex items-center gap-3">
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </span>
              {item.badge && item.badge.count > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${badgeTones[item.badge.tone]}`}>{item.badge.count}</span>
              )}
            </NavLink>
          ))}
        </nav>
        {footer && <div className="border-t border-white/10 px-6 py-4 text-xs text-white/60">{footer}</div>}
      </aside>
      <main className="min-w-0 flex-1 px-4 pt-16 pb-10 md:px-8 md:pt-8">
        <Outlet />
      </main>
    </div>
  );
}
