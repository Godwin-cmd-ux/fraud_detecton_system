import { forwardRef, useId } from 'react';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import { inputClass } from './Input';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, id, className = '', children, ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-semibold text-p-text">
          {label}
        </label>
      )}
      <select ref={ref} id={selectId} aria-invalid={error ? true : undefined} className={`${inputClass} ${className}`} {...rest}>
        {children}
      </select>
      {error ? <p className="text-xs text-p-danger">{error}</p> : hint ? <p className="text-xs text-p-muted">{hint}</p> : null}
    </div>
  );
});
