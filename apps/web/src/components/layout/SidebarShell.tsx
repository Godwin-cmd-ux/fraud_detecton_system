import { useLanguage, translate as tr } from '../../i18n';
import { Fragment, useEffect, useRef, useState } from 'react';
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
  /** Group heading shown above the first item of each group. */
  section?: string;
  badge?: SidebarBadge;
  /** Match the active state on the path only (ignore the query string). */
  end?: boolean;
  onClick?: () => void;
}

const badgeTones: Record<SidebarBadge['tone'], string> = {
  info: 'bg-s-teal/15 text-s-teal',
  warning: 'bg-s-amber/15 text-s-amber',
  fraud: 'bg-s-red text-s-bg',
  plain: 'bg-white/10 text-white/80',
};

export interface SidebarShellProps {
  brand: string;
  subtitle: string;
  profile: { initial: string; name: string; role: string };
  items: SidebarItem[];
  footer?: ReactNode;
}

function Brand({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-white">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-s-teal/12 text-s-teal">
        <ShieldCheck size={18} strokeWidth={2} aria-hidden="true" />
      </span>
      {name.replace(/^[^\p{L}\p{N}]+/u, '')}
    </span>
  );
}

/** Dark sidebar on desktop; below 768px a top bar opens it as a drawer. */
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
    <div className="app-shell flex min-h-screen flex-col md:flex-row">
      <a href="#workspace" className="skip-link">
        {tr('Skip to content')}
      </a>
      <header className="mobile-bar no-print sticky top-0 z-40 flex h-14 items-center justify-between px-4 md:hidden">
        <Brand name={brand} />
        <button
          ref={trigger}
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white transition hover:bg-white/10"
          onClick={() => setOpen((v) => !v)}
          aria-label={tr('Toggle menu')}
          aria-expanded={open}
          aria-controls="primary-sidebar"
        >
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </header>
      {open && (
        <div
          className="drawer-backdrop fixed inset-0 z-20 bg-[#0e2a2c]/50 backdrop-blur-[2px] md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        ref={sidebar}
        id="primary-sidebar"
        aria-label={tr('Main navigation')}
        className={`app-sidebar no-print fixed inset-y-0 left-0 z-30 flex w-[264px] flex-col text-white md:sticky md:top-0 md:h-screen md:shrink-0 md:translate-x-0 ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
      >
        <div className="px-6 pt-6 pb-5">
          <Brand name={brand} />
          <div className="mt-1.5 pl-[42px] text-[11px] tracking-wide text-white/45">
            {tr(subtitle)}
          </div>
        </div>
        <div className="mx-4 flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-s-teal text-sm font-semibold text-s-bg">
            {profile.initial}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{profile.name}</div>
            <div className="text-[11px] text-white/50">{tr(profile.role)}</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4">
          {items.map((item, index) => {
            const active =
              !item.onClick &&
              (item.to.includes('?') ? item.to === location.pathname + location.search : undefined);
            const showSection = item.section && item.section !== items[index - 1]?.section;
            return (
              <Fragment key={item.to + item.label}>
                {showSection && <div className="sidebar-section">{tr(item.section)}</div>}
                <NavLink
                  to={item.to}
                  end={item.end}
                  aria-current={item.to.includes('?') && active ? 'page' : undefined}
                  onClick={() => {
                    setOpen(false);
                    item.onClick?.();
                  }}
                  className={({ isActive }) =>
                    `sidebar-link mt-0.5 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm ${
                      !item.onClick &&
                      (item.to.includes('?')
                        ? active
                        : isActive && (!location.search || item.to !== '/admin/transactions'))
                        ? 'is-active font-medium'
                        : ''
                    }`
                  }
                >
                  <span className="flex items-center gap-3">
                    <DisplayIcon value={item.label} size={17} />
                    {tr(item.label)}
                  </span>
                  {item.badge && item.badge.count > 0 && (
                    <span className={`nav-count ${badgeTones[item.badge.tone]}`}>
                      {item.badge.count}
                    </span>
                  )}
                </NavLink>
              </Fragment>
            );
          })}
        </nav>
        {footer && (
          <div className="border-t border-white/8 px-6 py-4 text-[11px] leading-relaxed text-white/40">
            {footer}
          </div>
        )}
      </aside>
      <main
        id="workspace"
        tabIndex={-1}
        className="workspace min-w-0 flex-1 px-4 pt-5 pb-12 sm:px-6 md:px-8 md:pt-6 lg:px-10"
      >
        <div className="mx-auto max-w-[1440px]">
          <div className="no-print mb-6 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-xs font-medium text-p-muted">
              <span className="live-dot" aria-hidden="true" />
              {tr(subtitle)}
            </span>
            <LanguageSwitcher />
          </div>
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
