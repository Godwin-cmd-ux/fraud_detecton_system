import type { ReactNode } from 'react';
import type { RiskLevel, TransactionStatus } from '@fraud/shared';

export type BadgeTone = 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'dark';

const tones: Record<BadgeTone, string> = {
  green: 'bg-[#d1fae5] text-[#065f46]',
  red: 'bg-[#fee2e2] text-[#991b1b]',
  amber: 'bg-[#fef3c7] text-[#92400e]',
  blue: 'bg-[#dbeafe] text-[#1e40af]',
  gray: 'bg-p-bg text-p-muted border border-p-border',
  dark: 'bg-p-dark text-white',
};

export function Badge({ tone = 'gray', children, className = '' }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const tone: BadgeTone = status === 'SUCCESS' ? 'green' : status === 'ABORTED' ? 'red' : 'amber';
  return <Badge tone={tone}>{status}</Badge>;
}

/** Risk level with the PHP's PENDING fallback when no level is stored. */
export function RiskBadge({ level }: { level: RiskLevel | null | undefined }) {
  if (!level) return <Badge tone="gray">PENDING</Badge>;
  const tone: BadgeTone = level === 'HIGH' ? 'red' : level === 'MEDIUM' ? 'amber' : 'green';
  return <Badge tone={tone}>{level}</Badge>;
}

export function PredictionBadge({ prediction }: { prediction: 'FRAUD' | 'LEGIT' | 'PENDING' | null | undefined }) {
  if (!prediction || prediction === 'PENDING') return <Badge tone="gray">PENDING</Badge>;
  return <Badge tone={prediction === 'FRAUD' ? 'red' : 'green'}>{prediction}</Badge>;
}
