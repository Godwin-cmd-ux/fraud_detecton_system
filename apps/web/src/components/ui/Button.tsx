import { useLanguage, translate as tr } from '../../i18n';
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'success' | 'danger' | 'warning' | 'secondary' | 'ghost';

const styles: Record<ButtonVariant, string> = {
  primary: 'bg-p-primary text-white hover:bg-p-primary-dark',
  success: 'bg-p-success text-white hover:brightness-95',
  danger: 'bg-p-danger text-white hover:brightness-95',
  warning: 'bg-p-warning text-white hover:brightness-95',
  secondary: 'bg-p-bg text-p-text border border-p-border hover:bg-white',
  ghost: 'bg-transparent text-p-primary hover:bg-p-bg',
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
  const pad = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm';
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${pad} ${styles[variant]} ${className}`}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {tr(children)}
    </button>
  );
}
