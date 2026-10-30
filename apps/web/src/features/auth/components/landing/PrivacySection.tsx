import { useLanguage, translate as tr } from '../../../../i18n';
import { FRAUD } from '@fraud/shared';
import { EyeOff, LockKeyhole, ShieldCheck, UserCheck } from 'lucide-react';

/** Every item describes behaviour the app already enforces; durations come from FRAUD. */
function items() {
  return [
    {
      Icon: EyeOff,
      title: 'Hidden balance',
      body: `Your balance stays masked until you confirm your password, then hides again after ${FRAUD.BALANCE_REVEAL_TTL_MIN} minutes.`,
    },
    {
      Icon: LockKeyhole,
      title: 'Locked history',
      body: `Your transaction list needs your password to open and locks itself after ${FRAUD.TRANSACTIONS_UNLOCK_TTL_MIN} minutes.`,
    },
    {
      Icon: ShieldCheck,
      title: 'Sign-in lockout',
      body: `${FRAUD.LOGIN_MAX_FAILURES} wrong passwords lock sign-in for ${FRAUD.LOGIN_LOCKOUT_MIN} minutes.`,
    },
    {
      Icon: UserCheck,
      title: 'Approved accounts only',
      body: 'Every new account is checked by an administrator before its first sign-in.',
    },
  ];
}

/** Small looping illustration: a masked balance that unlocks and locks again. */
function MaskedBalance() {
  useLanguage();
  return (
    <div className="privacy-visual" aria-hidden="true">
      <div className="text-[11px] tracking-[0.14em] text-white/55 uppercase">
        {tr('Available Balance')}
      </div>
      <div className="privacy-visual__amount">
        <span className="privacy-visual__mask">••••••••••</span>
        <span className="privacy-visual__value tabular">TSh 1,840,000.00</span>
      </div>
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <span className="privacy-visual__lock flex h-9 w-9 items-center justify-center rounded-lg bg-s-teal/15 text-s-teal">
          <LockKeyhole size={16} />
        </span>
        <span className="flex-1">
          <span className="block h-2 w-24 rounded-full bg-white/15" />
          <span className="mt-2 block h-2 w-16 rounded-full bg-white/10" />
        </span>
        <span className="text-[11px] text-white/45">{tr('Password')}</span>
      </div>
    </div>
  );
}

export function PrivacySection() {
  useLanguage();
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
      <div className="reveal">
        <MaskedBalance />
      </div>
      <ul className="reveal grid gap-x-8 gap-y-7 sm:grid-cols-2">
        {items().map(({ Icon, title, body }) => (
          <li key={title}>
            <Icon size={20} strokeWidth={1.75} className="mb-3 text-s-teal" aria-hidden="true" />
            <h3 className="mb-1.5 font-medium">{tr(title)}</h3>
            <p className="text-[14.5px] leading-relaxed text-s-dim">{tr(body)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
