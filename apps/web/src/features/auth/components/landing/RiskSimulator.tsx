import { useLanguage, translate as tr } from '../../../../i18n';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { LOCATIONS } from '@fraud/shared';
import type { Location } from '@fraud/shared';
import { Ban, CircleCheck, Minus, Plus, RotateCcw, TriangleAlert } from 'lucide-react';
import { formatTsh } from '../../../../lib/format';
import { simulateTransfer } from '../../../../lib/riskDemo';
import type { DemoInput, DemoVerdict } from '../../../../lib/riskDemo';

const AMOUNTS = [
  10_000, 50_000, 125_000, 250_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_500_000, 5_000_000,
  7_500_000, 10_000_000, 12_000_000,
];

const START: DemoInput = {
  amount: 125_000,
  hour: 14,
  previousLocation: 'Dar es Salaam',
  currentLocation: 'Dar es Salaam',
  recentRecipients: 0,
  recipientSenders: 0,
  failedWithdrawals: 0,
};

const SCENARIOS: { label: string; input: DemoInput }[] = [
  { label: 'Everyday payment', input: START },
  { label: 'Late-night transfer', input: { ...START, amount: 2_500_000, hour: 2 } },
  { label: 'Sudden city change', input: { ...START, amount: 250_000, currentLocation: 'Mwanza' } },
  {
    label: 'Account takeover',
    input: { ...START, amount: 1_500_000, currentLocation: 'Kigoma', failedWithdrawals: 3 },
  },
];

/** Same colours as the rest of the app: green clears, amber needs review, red blocks. */
const VERDICTS: Record<
  DemoVerdict,
  { label: string; color: string; soft: string; Icon: typeof Ban }
> = {
  cleared: { label: 'Cleared', color: '#1d7550', soft: '#e4f1e9', Icon: CircleCheck },
  review: { label: 'Flagged for review', color: '#95600f', soft: '#f8eedb', Icon: TriangleAlert },
  blocked: { label: 'Blocked', color: '#b4383d', soft: '#f9e5e4', Icon: Ban },
};

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

function Control({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  useLanguage();
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-s-dim">{tr(label)}</span>
        {hint && <span className="tabular font-mono text-s-text">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Stepper({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  useLanguage();
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
      <span className="text-[13px] leading-snug text-s-dim">{tr(label)}</span>
      <span className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="sim-step"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value === 0}
          aria-label={`${tr('Decrease')}: ${tr(label)}`}
        >
          <Minus size={14} aria-hidden="true" />
        </button>
        <span className="tabular w-6 text-center font-mono text-sm" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          className="sim-step"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value === max}
          aria-label={`${tr('Increase')}: ${tr(label)}`}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}

function CitySelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Location;
  onChange: (value: Location) => void;
}) {
  useLanguage();
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[12px] text-s-dim">{tr(label)}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Location)}
        className="sim-select w-full"
      >
        {LOCATIONS.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Semicircular score gauge; the arc length animates between scores. */
function Gauge({ score, color }: { score: number; color: string }) {
  return (
    <svg viewBox="0 0 200 112" className="w-full max-w-[240px]" aria-hidden="true">
      <path
        d="M 16 100 A 84 84 0 0 1 184 100"
        fill="none"
        stroke="#e9ece5"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M 16 100 A 84 84 0 0 1 184 100"
        fill="none"
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${Math.max(score, 0.01)} 100`}
        className="sim-gauge__arc"
      />
    </svg>
  );
}

export function RiskSimulator() {
  useLanguage();
  const [input, setInput] = useState<DemoInput>(START);
  const set = (patch: Partial<DemoInput>) => setInput((prev) => ({ ...prev, ...patch }));
  const result = simulateTransfer(input);
  const verdict = VERDICTS[result.verdict];
  const amountIndex = Math.max(0, AMOUNTS.indexOf(input.amount));
  const scenario = SCENARIOS.find((s) => JSON.stringify(s.input) === JSON.stringify(input))?.label;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
      <div className="sim-panel">
        <div
          className="mb-6 flex flex-wrap gap-2"
          role="group"
          aria-label={tr('Example scenarios')}
        >
          {SCENARIOS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setInput(s.input)}
              aria-pressed={scenario === s.label}
              className="sim-chip"
            >
              {tr(s.label)}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          <Control label="Amount" hint={formatTsh(input.amount)}>
            <input
              type="range"
              min={0}
              max={AMOUNTS.length - 1}
              value={amountIndex}
              onChange={(e) => set({ amount: AMOUNTS[Number(e.target.value)]! })}
              aria-label={tr('Amount')}
              aria-valuetext={formatTsh(input.amount)}
              className="sim-range"
            />
          </Control>

          <Control label="Time of day" hint={hourLabel(input.hour)}>
            <input
              type="range"
              min={0}
              max={23}
              value={input.hour}
              onChange={(e) => set({ hour: Number(e.target.value) })}
              aria-label={tr('Time of day')}
              aria-valuetext={hourLabel(input.hour)}
              className="sim-range"
            />
          </Control>

          <div className="grid grid-cols-2 gap-3">
            <CitySelect
              label="Last transfer from"
              value={input.previousLocation}
              onChange={(previousLocation) => set({ previousLocation })}
            />
            <CitySelect
              label="Sending from now"
              value={input.currentLocation}
              onChange={(currentLocation) => set({ currentLocation })}
            />
          </div>

          <div className="space-y-2">
            <Stepper
              label="People you paid in the last 5 minutes"
              value={input.recentRecipients}
              max={3}
              onChange={(recentRecipients) => set({ recentRecipients })}
            />
            <Stepper
              label="People who paid this recipient in the last 7 minutes"
              value={input.recipientSenders}
              max={2}
              onChange={(recipientSenders) => set({ recipientSenders })}
            />
            <Stepper
              label="Failed withdrawals in the last 10 minutes"
              value={input.failedWithdrawals}
              max={3}
              onChange={(failedWithdrawals) => set({ failedWithdrawals })}
            />
          </div>
        </div>
      </div>

      <div className="sim-result" style={{ '--verdict': verdict.color } as React.CSSProperties}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-p-dark">{tr('Screening result')}</h3>
          <button
            type="button"
            onClick={() => setInput(START)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-p-muted transition hover:bg-[#eef0eb] hover:text-p-dark"
          >
            <RotateCcw size={13} aria-hidden="true" />
            {tr('Reset')}
          </button>
        </div>

        <div className="relative mx-auto mt-4 flex max-w-[240px] flex-col items-center">
          <Gauge score={result.score} color={verdict.color} />
          <div className="absolute inset-x-0 bottom-0 text-center">
            <div className="tabular text-4xl font-semibold tracking-tight text-p-dark">
              {result.score}
            </div>
            <div className="text-[11px] tracking-[0.12em] text-p-muted uppercase">
              {tr('Risk score')}
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-center" aria-live="polite">
          <span
            key={result.verdict}
            className="sim-verdict"
            style={{ background: verdict.soft, color: verdict.color }}
          >
            <verdict.Icon size={16} aria-hidden="true" />
            {tr(verdict.label)}
          </span>
        </div>

        <ul className="mt-6 space-y-2" aria-label={tr('Signals')}>
          {result.signals.length === 0 ? (
            <li className="sim-signal text-p-muted">
              {tr('No risk signals. This looks like normal activity.')}
            </li>
          ) : (
            result.signals.map((signal) => (
              <li key={signal.label} className="sim-signal">
                <span className="text-p-text">
                  {tr(signal.label)}
                  {signal.label === 'Sent from a different city' && (
                    <span className="text-p-muted"> · {result.distanceKm} km</span>
                  )}
                </span>
                <span
                  className="tabular shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold"
                  style={
                    signal.blocks
                      ? { background: '#f9e5e4', color: '#b4383d' }
                      : { background: '#f8eedb', color: '#95600f' }
                  }
                >
                  {signal.blocks ? tr('BLOCK') : `+${signal.points}`}
                </span>
              </li>
            ))
          )}
        </ul>

        <p className="mt-auto pt-6 text-[11.5px] leading-relaxed text-p-muted">
          {tr(
            'Uses the same rules as the live system. In real transfers the machine-learning model adds its own score on top.',
          )}
        </p>
      </div>
    </div>
  );
}
