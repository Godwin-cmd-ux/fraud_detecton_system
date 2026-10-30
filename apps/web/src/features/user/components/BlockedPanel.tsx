import { useLanguage, translate as tr } from '../../../i18n';
import { Ban } from 'lucide-react';
import { plainText } from '../../../lib/text';
/** Replaces the form after a blocked transfer or withdrawal, mirroring the original red panel. */
export function BlockedPanel({
  title,
  reason,
  details,
}: {
  title: string;
  reason: string;
  details: string;
}) {
  useLanguage();
  return (
    <div
      role="alert"
      className="animate-slide-down rounded-xl border border-risk/25 bg-risk-soft p-5"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-risk text-white">
          <Ban size={18} aria-hidden="true" />
        </span>
        <div className="text-base font-semibold tracking-wide text-risk">
          {tr(plainText(title))}
        </div>
      </div>
      <div className="my-3 text-sm text-p-text">{tr(plainText(reason))}</div>
      <div className="rounded-lg border border-risk/10 bg-white p-4 text-sm whitespace-pre-line text-p-text">
        <span className="font-semibold">{tr('Reason: ')}</span>
        {tr(plainText(details))}
      </div>
      <div className="mt-3 text-sm text-p-muted">
        {tr('If you believe this is a mistake, please contact our support team.')}
      </div>
    </div>
  );
}
