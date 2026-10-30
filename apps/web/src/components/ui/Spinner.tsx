import { useLanguage, translate as tr } from '../../i18n';
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  useLanguage();
  return (
    <div role="status" aria-live="polite" className="inline-flex items-center gap-2 text-p-muted">
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-p-border border-t-p-primary" />
      <span className="text-sm">{tr(label)}</span>
    </div>
  );
}
