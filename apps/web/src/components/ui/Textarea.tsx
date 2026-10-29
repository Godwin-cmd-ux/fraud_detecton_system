import { forwardRef, useId } from 'react';
import type { ReactNode, TextareaHTMLAttributes } from 'react';
import { inputClass } from './Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, id, className = '', ...rest },
  ref,
) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={areaId} className="text-sm font-semibold text-p-text">
          {label}
        </label>
      )}
      <textarea ref={ref} id={areaId} aria-invalid={error ? true : undefined} className={`${inputClass} ${className}`} {...rest} />
      {error ? <p className="text-xs text-p-danger">{error}</p> : hint ? <p className="text-xs text-p-muted">{hint}</p> : null}
    </div>
  );
});
