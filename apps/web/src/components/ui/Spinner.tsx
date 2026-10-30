import { useLanguage, translate as tr } from '../../i18n';
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  useLanguage();
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-slide-down inline-flex items-center gap-2.5 py-6 text-p-muted"
    >
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-p-border border-t-p-primary" />
      <span className="text-sm">{tr(label)}</span>
    </div>
  );
}
