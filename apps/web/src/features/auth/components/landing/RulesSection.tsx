import { useLanguage, translate as tr } from '../../../../i18n';
import { FRAUD } from '@fraud/shared';
import { Clock3, Layers, MapPinned, Moon, Users, WalletCards } from 'lucide-react';
import { formatTsh } from '../../../../lib/format';

/** Thresholds come from the shared FRAUD constants, so this copy can't drift from the backend. */
function rules() {
  const large = formatTsh(FRAUD.LARGE_TX_THRESHOLD);
  return [
    {
      Icon: Layers,
      title: 'Bursts of large transfers',
      body: `${FRAUD.LARGE_VOLUME_MAX_COUNT} transfers over ${large} totalling more than ${formatTsh(FRAUD.LARGE_VOLUME_MAX_SUM)} within ${FRAUD.LARGE_VOLUME_WINDOW_MIN} minutes are blocked.`,
    },
    {
      Icon: Users,
      title: 'Paying many people at once',
      body: `Sending to ${FRAUD.MANY_RECEIVERS_BLOCK_AT} different people within ${FRAUD.MANY_RECEIVERS_WINDOW_MIN} minutes is blocked.`,
    },
    {
      Icon: WalletCards,
      title: 'Accounts collecting money',
      body: `A recipient receiving from ${FRAUD.MANY_SENDERS_BLOCK_AT} different senders within ${FRAUD.MANY_SENDERS_WINDOW_MIN} minutes is blocked.`,
    },
    {
      Icon: Clock3,
      title: 'Failed withdrawals',
      body: `${FRAUD.FAILED_WITHDRAWAL_BLOCK_COUNT} failed withdrawal attempts block further withdrawals, and any transfer within ${FRAUD.FAILED_WITHDRAWALS_WINDOW_MIN} minutes.`,
    },
    {
      Icon: MapPinned,
      title: 'Sudden location changes',
      body: 'Switching cities raises the risk score, more for longer distances. Combined with a large amount, the transfer is blocked.',
    },
    {
      Icon: Moon,
      title: 'Unusual time or amount',
      body: `Transfers over ${large} between midnight and 6:00, or over ${formatTsh(FRAUD.EXTREME_AMOUNT)} at any time, are blocked.`,
    },
  ];
}

export function RulesSection() {
  useLanguage();
  return (
    <div>
      <div className="reveal grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rules().map(({ Icon, title, body }, index) => (
          <article key={title} className="rule-card" style={{ animationDelay: `${index * 60}ms` }}>
            <span className="capability-icon !mb-5" aria-hidden="true">
              <Icon size={20} strokeWidth={1.75} />
            </span>
            <h3 className="mb-2 text-[17px] font-medium tracking-tight">{tr(title)}</h3>
            <p className="text-[14.5px] leading-relaxed text-s-dim">{tr(body)}</p>
          </article>
        ))}
      </div>
      <p className="reveal mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-[14.5px] text-s-dim">
        <span className="font-mono text-xs tracking-widest text-s-teal uppercase">
          {tr('Then')}
        </span>
        {tr(
          `An XGBoost model scores every transfer on 11 signals. Scores between ${FRAUD.FLAG_REVIEW_MIN_EXCLUSIVE} and ${FRAUD.FLAG_REVIEW_MAX_INCLUSIVE} are flagged for an administrator to review.`,
        )}
      </p>
    </div>
  );
}
