import { useLanguage, translate as tr } from '../../i18n';
import { riskColor } from '../../lib/format';

/** Score bar with risk colour thresholds; `twoTone` uses red/amber for alert pages. */
export function RiskBar({ score, twoTone = false }: { score: number; twoTone?: boolean }) {
  useLanguage();
  const color = twoTone ? (score > 70 ? '#ef4444' : '#f59e0b') : riskColor(score);
  const width = Math.max(0, Math.min(100, score));
  return (
    <div className="flex items-center gap-2" title={tr(`Risk score ${score}%`)}>
      <div className="h-2 w-24 overflow-hidden rounded-full bg-p-border">
        <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold" style={{ color }}>
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
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-gradient-to-r from-p-success via-p-warning to-p-danger">
        <div
          className="absolute top-0 right-0 h-full bg-white/80"
          style={{ width: `${100 - width}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-p-muted">
        <span>0%</span>
        <span>{tr('30% · Low')}</span>
        <span>{tr('70% · Medium')}</span>
        <span>{tr('100% · High')}</span>
      </div>
    </div>
  );
}
