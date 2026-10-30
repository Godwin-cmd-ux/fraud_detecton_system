import { useLanguage, translate as tr } from '../../i18n';
import type { ReactNode } from 'react';
import type { RiskLevel, TransactionStatus } from '@fraud/shared';

export type BadgeTone = 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'dark';

const tones: Record<BadgeTone, string> = {
  green: 'bg-ok-soft text-ok',
  red: 'bg-risk-soft text-risk',
  amber: 'bg-warn-soft text-warn',
  blue: 'bg-info-soft text-info',
  gray: 'bg-[#eef0eb] text-p-muted',
  dark: 'bg-p-dark text-white',
};

export function Badge({
  tone = 'gray',
  children,
  className = '',
  dot = false,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  /** Leading status dot, used where the badge reports a state rather than a label. */
  dot?: boolean;
}) {
  useLanguage();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-semibold tracking-wide whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {tr(children)}
    </span>
  );
}

export function StatusBadge({ status }: { status: TransactionStatus }) {
  useLanguage();
  const tone: BadgeTone = status === 'SUCCESS' ? 'green' : status === 'ABORTED' ? 'red' : 'amber';
  return (
    <Badge tone={tone} dot>
      {tr(status)}
    </Badge>
  );
}

/** Risk level with a PENDING fallback when no level is stored. */
export function RiskBadge({ level }: { level: RiskLevel | null | undefined }) {
  useLanguage();
  if (!level) return <Badge tone="gray">{tr('PENDING')}</Badge>;
  const tone: BadgeTone = level === 'HIGH' ? 'red' : level === 'MEDIUM' ? 'amber' : 'green';
  return <Badge tone={tone}>{tr(level)}</Badge>;
}

export function PredictionBadge({
  prediction,
}: {
  prediction: 'FRAUD' | 'LEGIT' | 'PENDING' | null | undefined;
}) {
  useLanguage();
  if (!prediction || prediction === 'PENDING') return <Badge tone="gray">{tr('PENDING')}</Badge>;
  return <Badge tone={prediction === 'FRAUD' ? 'red' : 'green'}>{tr(prediction)}</Badge>;
}
