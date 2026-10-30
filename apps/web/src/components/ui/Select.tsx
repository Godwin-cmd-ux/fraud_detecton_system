import { useLanguage, translate as tr } from '../../i18n';
import { forwardRef, useId } from 'react';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import { inputClass } from './Input';
import { localizeValidity } from '../../i18n/validation';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, id, className = '', children, ...rest },
  ref,
) {
  useLanguage();
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-[13px] font-medium text-p-dark">
          {tr(label)}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={`${inputClass} ${className}`}
        {...rest}
        onInvalid={(event) => {
          localizeValidity(event.currentTarget);
          rest.onInvalid?.(event);
        }}
        onInput={(event) => {
          event.currentTarget.setCustomValidity('');
          rest.onInput?.(event);
        }}
      >
        {children}
      </select>
      {error ? (
        <p className="text-xs text-p-danger">{tr(error)}</p>
      ) : hint ? (
        <p className="text-xs text-p-muted">{tr(hint)}</p>
      ) : null}
    </div>
  );
});
