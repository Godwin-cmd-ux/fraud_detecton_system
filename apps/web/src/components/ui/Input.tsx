import { useLanguage, translate as tr } from '../../i18n';
import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { localizeValidity } from '../../i18n/validation';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
}

export const inputClass =
  'w-full rounded-lg border border-p-border bg-white px-3 py-2.5 text-sm text-p-text outline-none transition focus:border-p-primary focus:ring-2 focus:ring-p-primary/20 disabled:bg-p-bg';

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, className = '', ...rest },
  ref,
) {
  useLanguage();
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-p-text">
          {tr(label)}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={`${inputClass} ${error ? 'border-p-danger' : ''} ${className}`}
        {...rest}
        onInvalid={(event) => {
          localizeValidity(event.currentTarget);
          rest.onInvalid?.(event);
        }}
        onInput={(event) => {
          event.currentTarget.setCustomValidity('');
          rest.onInput?.(event);
        }}
      />
      {error ? (
        <p className="text-xs text-p-danger">{tr(error)}</p>
      ) : hint ? (
        <p className="text-xs text-p-muted">{tr(hint)}</p>
      ) : null}
    </div>
  );
});
