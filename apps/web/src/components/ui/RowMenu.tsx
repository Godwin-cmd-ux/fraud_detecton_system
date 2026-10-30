import { useLanguage, translate as tr } from '../../i18n';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

export interface RowMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

/**
 * Overflow menu for secondary row actions. Portalled to <body> and positioned with
 * `fixed`, so neither table scroll containers nor animated (transformed) rows can
 * clip or offset it; closes on Escape, outside click, scroll or resize.
 */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const rect = button.current.getBoundingClientRect();
    const menuHeight = menu.current?.offsetHeight ?? 0;
    const below = rect.bottom + 6 + menuHeight <= window.innerHeight;
    setPosition({
      top: below ? rect.bottom + 6 : Math.max(8, rect.top - 6 - menuHeight),
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const close = () => setOpen(false);
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        button.current?.focus();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const entries = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
      const index = entries.indexOf(document.activeElement as HTMLElement);
      const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
      entries[(next + entries.length) % entries.length]?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={tr(label)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-p-muted transition hover:border-[#cbd4c8] hover:text-p-dark ${open ? 'border-[#cbd4c8] bg-[#f4f5f1] text-p-dark' : 'border-p-border bg-white'}`}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="menu"
            aria-label={tr(label)}
            className="row-menu fixed z-50 min-w-[190px] rounded-xl border border-p-border bg-white p-1.5 shadow-[0_16px_40px_-16px_#14302b55]"
            style={position ?? { top: -9999, right: 0 }}
          >
            {items.map((item, index) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition focus:outline-none ${
                  item.danger
                    ? 'text-risk hover:bg-risk-soft focus-visible:bg-risk-soft'
                    : 'text-p-text hover:bg-[#f4f5f1] focus-visible:bg-[#f4f5f1]'
                } ${item.danger && index > 0 ? 'mt-1 border-t border-p-border pt-2.5' : ''}`}
              >
                <span className="flex w-4 justify-center opacity-80">{item.icon}</span>
                {tr(item.label)}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
