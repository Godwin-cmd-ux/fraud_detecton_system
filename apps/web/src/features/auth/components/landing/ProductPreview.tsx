import { useLanguage, translate as tr } from '../../../../i18n';
import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { TransactionListItem } from '@fraud/shared';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpRight,
  Eye,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { RiskBadge, StatusBadge } from '../../../../components/ui/Badge';
import { RiskBar } from '../../../../components/ui/RiskBar';
import { formatTsh } from '../../../../lib/format';
import { TransactionLabel } from '../../../user/components/TransactionDetailsModal';

/** Sample rows for the preview only; rendered with the app's real components. */
const tx = (
  id: number,
  direction: TransactionListItem['direction'],
  counterpartyName: string | null,
  amount: number,
  status: TransactionListItem['status'],
  riskLevel: TransactionListItem['riskLevel'],
): TransactionListItem => ({
  id,
  transactionId: `TXN${8800 + id}`,
  type: direction === 'withdrawal' ? 'withdrawal' : 'transfer',
  direction,
  counterpartyName,
  amount,
  status,
  fraudScore: 0,
  fraudPrediction: null,
  riskLevel,
  message: null,
  location: null,
  createdAt: '',
});

const CUSTOMER_ROWS = [
  tx(1, 'received', 'Baraka Mushi', 125_000, 'SUCCESS', 'LOW'),
  tx(2, 'sent', 'Neema Joseph', 48_000, 'SUCCESS', 'LOW'),
  tx(3, 'withdrawal', null, 300_000, 'PENDING', 'MEDIUM'),
];

const ALERTS = [
  { from: 'Juma Ally', to: 'Rehema Said', amount: 2_500_000, score: 86, level: 'HIGH' as const },
  { from: 'Asha Mollel', to: 'Peter Kimaro', amount: 1_200_000, score: 75, level: 'HIGH' as const },
  {
    from: 'Neema Joseph',
    to: 'Baraka Mushi',
    amount: 640_000,
    score: 58,
    level: 'MEDIUM' as const,
  },
];

const TABS = [
  { key: 'customer', label: 'Customer wallet', path: 'app/dashboard' },
  { key: 'admin', label: 'Admin fraud alerts', path: 'admin/fraud-alerts' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  useLanguage();
  return (
    <div className="flex flex-col justify-between rounded-xl border border-p-border bg-white px-3 py-2.5 sm:px-3.5 sm:py-3">
      <div className="text-[11px] leading-tight text-p-muted">{tr(label)}</div>
      <div className="tabular mt-1 text-lg font-semibold" style={{ color: tone ?? '#142e2b' }}>
        {value}
      </div>
    </div>
  );
}

function CustomerView() {
  useLanguage();
  return (
    <div className="space-y-3">
      <div className="preview-balance">
        <div className="text-[10px] tracking-[0.14em] text-white/60 uppercase">
          {tr('Available Balance')}
        </div>
        <div className="mt-1.5 flex items-center gap-2.5 text-xl font-semibold tracking-tight">
          <span className="preview-balance__value tabular">{formatTsh(1_840_000)}</span>
          <Eye size={15} className="text-white/50" aria-hidden="true" />
        </div>
        <div className="mt-3 flex gap-2">
          <span className="preview-pill bg-s-teal text-s-bg">
            <ArrowUpRight size={12} aria-hidden="true" />
            {tr('Send Money')}
          </span>
          <span className="preview-pill border border-white/15 text-white">
            <ArrowDownToLine size={12} aria-hidden="true" />
            {tr('Withdraw')}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <Tile label="Total Transactions" value="48" />
        <Tile label="Successful" value="41" tone="#1d7550" />
        <Tile label="Success Rate" value="85%" />
      </div>
      <div className="rounded-xl border border-p-border bg-white">
        <div className="border-b border-p-border px-3.5 py-2.5 text-[12.5px] font-semibold text-p-dark">
          {tr('Recent Transactions')}
        </div>
        <ul className="preview-rows divide-y divide-[#eceee8]">
          {CUSTOMER_ROWS.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[12.5px]"
            >
              <span className="min-w-0 truncate">
                <TransactionLabel t={t} />
              </span>
              <span className="flex shrink-0 items-center gap-2.5">
                <span className="tabular hidden font-medium text-p-dark sm:inline">
                  {formatTsh(t.amount)}
                </span>
                <StatusBadge status={t.status} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AdminView() {
  useLanguage();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2.5">
        <Tile label="Fraud detected" value="37" tone="#b4383d" />
        <Tile label="High risk" value="3" tone="#b4383d" />
        <Tile label="AI Review Queue" value="1" tone="#95600f" />
      </div>
      <div className="rounded-xl border border-p-border bg-white">
        <div className="border-b border-p-border px-3.5 py-2.5 text-[12.5px] font-semibold text-p-dark">
          {tr('Recent Fraud Alerts')}
        </div>
        <ul className="preview-rows divide-y divide-[#eceee8]">
          {ALERTS.map((a) => (
            <li
              key={a.from}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-3.5 py-3 text-[12.5px] sm:grid-cols-[1.4fr_1fr_auto_auto]"
            >
              <span className="min-w-0 truncate text-p-text">
                {a.from} <span className="text-p-muted">→</span> {a.to}
              </span>
              <span className="tabular hidden font-medium text-p-dark sm:inline">
                {formatTsh(a.amount)}
              </span>
              <RiskBar score={a.score} />
              <span className="hidden sm:inline">
                <RiskBadge level={a.level} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const SIDEBAR_ICONS = {
  customer: [LayoutDashboard, ArrowUpRight, ArrowDownToLine, ArrowLeftRight],
  admin: [LayoutDashboard, Users, ArrowLeftRight, ShieldCheck],
};

export function ProductPreview() {
  useLanguage();
  const [active, setActive] = useState<TabKey>('customer');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const current = TABS.find((t) => t.key === active)!;

  function onKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    setActive(TABS[next]!.key);
    tabs.current[next]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label={tr('Product preview')} className="preview-tabs mb-5">
        {TABS.map((t, index) => (
          <button
            key={t.key}
            ref={(el) => {
              tabs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${t.key}`}
            aria-selected={active === t.key}
            aria-controls={`${id}-panel`}
            tabIndex={active === t.key ? 0 : -1}
            onClick={() => setActive(t.key)}
            onKeyDown={(e) => onKey(e, index)}
          >
            {tr(t.label)}
          </button>
        ))}
      </div>

      <div className="preview-window">
        <div className="flex items-center gap-3 border-b border-p-border bg-[#eef0eb] px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#d9ddd5]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#d9ddd5]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#d9ddd5]" />
          </span>
          <span className="tabular min-w-0 flex-1 truncate rounded-md bg-white px-3 py-1 font-mono text-[11px] text-p-muted">
            sentinel / {current.path}
          </span>
          <span className="hidden shrink-0 rounded-full bg-white px-2.5 py-1 text-[10.5px] font-medium text-p-muted sm:inline">
            {tr('Sample data')}
          </span>
        </div>
        <div className="flex min-h-[380px] bg-p-bg">
          <div
            className="hidden w-14 shrink-0 flex-col items-center gap-3 bg-s-bg py-4 sm:flex"
            aria-hidden="true"
          >
            <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-s-teal/15 text-s-teal">
              <ShieldCheck size={16} />
            </span>
            {SIDEBAR_ICONS[active].map((Icon, index) => (
              <span
                key={index}
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${index === (active === 'admin' ? 3 : 0) ? 'bg-white/10 text-s-teal' : 'text-white/40'}`}
              >
                <Icon size={15} />
              </span>
            ))}
          </div>
          <div
            key={active}
            role="tabpanel"
            id={`${id}-panel`}
            aria-labelledby={`${id}-tab-${active}`}
            className="preview-panel min-w-0 flex-1 p-4 sm:p-5"
          >
            <div className="mb-3.5 text-[15px] font-semibold text-p-dark">
              {tr(active === 'customer' ? 'Dashboard' : 'Fraud Alerts')}
            </div>
            {active === 'customer' ? <CustomerView /> : <AdminView />}
          </div>
        </div>
      </div>
    </div>
  );
}
