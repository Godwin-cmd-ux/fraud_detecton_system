import { useLanguage, translate as tr } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';
import { Menu, X, ShieldCheck } from 'lucide-react';
import { DisplayIcon } from '../ui/DisplayIcon';

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
  useLanguage();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const sidebar = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar.current?.querySelector<HTMLElement>('a')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Tab') return;
      const links = sidebar.current?.querySelectorAll<HTMLElement>('a, button');
      if (!links?.length) return;
      const first = links[0]!;
      const last = links[links.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      trigger.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="app-shell flex min-h-screen">
      <a href="#workspace" className="skip-link">
        {tr('Skip to content')}
      </a>
      <button
        ref={trigger}
        type="button"
        className="no-print fixed top-3 left-3 z-40 rounded-lg bg-p-darker px-3 py-2 text-sm font-semibold text-white shadow md:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-label={tr('Toggle menu')}
        aria-expanded={open}
        aria-controls="primary-sidebar"
      >
        {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>
      {open && (
        <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setOpen(false)} />
      )}
      <aside
        ref={sidebar}
        id="primary-sidebar"
        aria-label={tr('Main navigation')}
        className={`app-sidebar no-print fixed inset-y-0 left-0 z-30 flex w-[264px] flex-col text-white transition-transform md:sticky md:top-0 md:h-screen md:shrink-0 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3 text-xl font-semibold tracking-tight">
            <ShieldCheck size={26} className="text-s-teal" aria-hidden="true" />
            {brand.replace(/^[^\p{L}\p{N}]+/u, '')}
          </div>
          <div className="mt-2 text-xs text-white/50">{tr(subtitle)}</div>
        </div>
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-p-primary text-lg font-bold">
            {profile.initial}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{profile.name}</div>
            <div className="text-xs text-white/60">{tr(profile.role)}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => (
            <NavLink
              key={item.to + item.label}
              to={item.to}
              end={item.end}
              aria-current={
                item.to.includes('?')
                  ? item.to === location.pathname + location.search
                    ? 'page'
                    : undefined
                  : undefined
              }
              onClick={() => {
                setOpen(false);
                item.onClick?.();
              }}
              className={({ isActive }) =>
                `sidebar-link flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm transition ${!item.onClick && (item.to.includes('?') ? item.to === location.pathname + location.search : isActive && (!location.search || item.to !== '/admin/transactions')) ? 'is-active font-semibold' : ''}`
              }
            >
              <span className="flex items-center gap-3">
                <DisplayIcon value={item.label} size={18} />
                {tr(item.label)}
              </span>
              {item.badge && item.badge.count > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${badgeTones[item.badge.tone]}`}
                >
                  {item.badge.count}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        {footer && (
          <div className="border-t border-white/10 px-6 py-4 text-xs text-white/60">{footer}</div>
        )}
      </aside>
      <main
        id="workspace"
        tabIndex={-1}
        className="workspace min-w-0 flex-1 px-4 pt-16 pb-10 md:px-8 md:pt-6 lg:px-10"
      >
        <div className="workspace-toolbar mb-7 flex items-center justify-between gap-3 border-b border-p-border pb-5">
          <span className="text-xs font-medium text-p-muted">{tr(subtitle)}</span>
          <LanguageSwitcher />
        </div>
        <div className="mx-auto max-w-[1440px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
