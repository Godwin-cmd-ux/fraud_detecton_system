import { useLanguage, translate as tr } from '../../i18n';
import { forwardRef, useId } from 'react';
import type { ReactNode, TextareaHTMLAttributes } from 'react';
import { inputClass } from './Input';
import { localizeValidity } from '../../i18n/validation';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, id, className = '', ...rest },
  ref,
) {
  useLanguage();
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={areaId} className="text-sm font-semibold text-p-text">
          {tr(label)}
        </label>
      )}
      <textarea
        ref={ref}
        id={areaId}
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
      />
      {error ? (
        <p className="text-xs text-p-danger">{tr(error)}</p>
      ) : hint ? (
        <p className="text-xs text-p-muted">{tr(hint)}</p>
      ) : null}
    </div>
  );
});
