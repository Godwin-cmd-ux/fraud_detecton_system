import { useLanguage, translate as tr } from '../../i18n';
import { riskColor } from '../../lib/format';

/** Score bar with risk colour thresholds; `twoTone` uses red/amber for alert pages. */
export function RiskBar({ score, twoTone = false }: { score: number; twoTone?: boolean }) {
  useLanguage();
  const color = twoTone ? (score > 70 ? riskColor(100) : riskColor(50)) : riskColor(score);
  const width = Math.max(0, Math.min(100, score));
  return (
    <div className="flex items-center gap-2" title={tr(`Risk score ${score}%`)}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#eceee8]">
        <div
          className="risk-fill h-full rounded-full"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
      <span className="tabular text-xs font-semibold" style={{ color }}>
        {score}%
      </span>
    </div>
  );
}

/** The details-page meter with Low / Medium / High ticks at 0, 30, 70 and 100. */
export function RiskMeter({ score }: { score: number }) {
  useLanguage();
  const width = Math.max(0, Math.min(100, score));
  return (
    <div>
      <div className="relative h-2.5 w-full rounded-full bg-gradient-to-r from-ok via-warn to-risk">
        <div
          className="absolute top-0 right-0 h-full rounded-r-full bg-[#eceee8]"
          style={{ width: `${100 - width}%` }}
        />
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow"
          style={{ left: `${width}%`, background: riskColor(score) }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-p-muted">
        <span>0%</span>
        <span>{tr('30% · Low')}</span>
        <span>{tr('70% · Medium')}</span>
        <span>{tr('100% · High')}</span>
      </div>
    </div>
  );
}
