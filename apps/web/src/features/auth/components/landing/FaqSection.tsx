import { useLanguage, translate as tr } from '../../../../i18n';
import { useId, useState } from 'react';
import { FRAUD } from '@fraud/shared';
import { Plus } from 'lucide-react';

/** Each answer describes behaviour the API enforces; durations and counts come from FRAUD. */
function questions() {
  return [
    {
      q: 'How long does account approval take?',
      a: 'An administrator reviews every new account by hand. Until it is approved, signing in shows that the account is pending; once approved you can sign in straight away.',
    },
    {
      q: 'Why was my transfer blocked?',
      a: 'A transfer is blocked when it matches one of the fraud rules, such as paying many people in a few minutes or sending a large amount at night. The message shows the reason. For activity limits, wait a few minutes and try again.',
    },
    {
      q: 'What does "flagged for review" mean?',
      a: `Your transfer went through, but its risk score was between ${FRAUD.FLAG_REVIEW_MIN_EXCLUSIVE} and ${FRAUD.FLAG_REVIEW_MAX_INCLUSIVE}, so an administrator will look at it. No action is needed from you.`,
    },
    {
      q: 'Why are my withdrawals blocked?',
      a: `After ${FRAUD.FAILED_WITHDRAWAL_BLOCK_COUNT} failed withdrawal attempts, withdrawals are paused to protect your account. The block clears ${FRAUD.FAILED_WITHDRAWAL_RESET_HOURS} hours after the last failed attempt.`,
    },
    {
      q: 'I forgot my password. What do I do?',
      a: `Choose "Forgot password?" on the sign-in page and answer at least 3 of your security questions. You get a reset link that works for ${FRAUD.RESET_TOKEN_TTL_MIN} minutes.`,
    },
    {
      q: 'I typed the wrong password and now I am locked out.',
      a: `After ${FRAUD.LOGIN_MAX_FAILURES} wrong passwords, sign-in is locked for ${FRAUD.LOGIN_LOCKOUT_MIN} minutes. The sign-in page shows a countdown; try again when it ends.`,
    },
    {
      q: 'Which languages and currency are supported?',
      a: 'The whole system works in English and Kiswahili, and all amounts are in Tanzanian shillings (TSh).',
    },
  ];
}

function Item({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  useLanguage();
  const id = useId();
  return (
    <div className={`faq-item ${open ? 'is-open' : ''}`}>
      <h3>
        <button
          type="button"
          id={`${id}-q`}
          aria-expanded={open}
          aria-controls={`${id}-a`}
          onClick={onToggle}
          className="faq-item__q"
        >
          <span>{tr(q)}</span>
          <span className="faq-item__icon" aria-hidden="true">
            <Plus size={16} />
          </span>
        </button>
      </h3>
      <div
        id={`${id}-a`}
        role="region"
        aria-labelledby={`${id}-q`}
        className="faq-item__a"
        inert={!open}
      >
        <div className="overflow-hidden">
          <p className="pb-5 leading-relaxed text-s-dim">{tr(a)}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqSection() {
  useLanguage();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="reveal faq-list">
      {questions().map((item, index) => (
        <Item
          key={item.q}
          q={item.q}
          a={item.a}
          open={open === index}
          onToggle={() => setOpen(open === index ? null : index)}
        />
      ))}
    </div>
  );
}
