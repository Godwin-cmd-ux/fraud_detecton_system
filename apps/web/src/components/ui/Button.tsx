import { useLanguage, translate as tr } from '../../i18n';
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'success' | 'danger' | 'warning' | 'secondary' | 'ghost';

const styles: Record<ButtonVariant, string> = {
  primary: 'bg-p-primary text-white shadow-sm shadow-p-primary/20 hover:bg-p-primary-dark',
  success: 'bg-ok-soft text-ok border border-ok/15 hover:border-ok/35',
  danger: 'bg-p-danger text-white shadow-sm shadow-p-danger/20 hover:bg-[#9c2f34]',
  warning: 'bg-warn-soft text-warn border border-warn/15 hover:border-warn/35',
  secondary:
    'bg-white text-p-text border border-p-border hover:border-[#cbd4c8] hover:bg-[#fafbf8]',
  ghost: 'bg-transparent text-p-primary hover:bg-p-primary/8',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  useLanguage();
  const pad =
    size === 'sm'
      ? 'min-h-8 rounded-lg px-3 py-1 text-[13px]'
      : 'min-h-10 rounded-[10px] px-4 py-2.5 text-sm';
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100 ${pad} ${styles[variant]} ${className}`}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      )}
      {tr(children)}
    </button>
  );
}
