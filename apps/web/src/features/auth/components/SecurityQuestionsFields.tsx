import { useLanguage, translate as tr } from '../../../i18n';
import { Check, KeyRound } from 'lucide-react';
import { AuthField } from './AuthForm';
import type { SecurityQuestion } from './AuthForm';

const REQUIRED = 3;

export function SecurityQuestionsFields({
  questions,
  answers,
  onChange,
  disabled = false,
}: {
  questions: SecurityQuestion[];
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
  disabled?: boolean;
}) {
  useLanguage();
  const count = questions.filter(({ key }) => answers[key]?.trim()).length;
  const progress = Math.min(count, REQUIRED) / REQUIRED;
  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="mb-2 font-semibold">{tr('Security questions')}</legend>
      <div className="rounded-xl border border-s-line bg-s-panel2/60 p-3.5">
        <p className="flex items-center justify-between gap-3 text-sm text-s-dim">
          <span>
            {count}
            {tr('/3 answered. Answer at least three questions.')}
          </span>
          {count >= REQUIRED && (
            <Check
              size={16}
              className="animate-slide-down shrink-0 text-s-teal"
              aria-hidden="true"
            />
          )}
        </p>
        <span
          className="mt-2.5 block h-1 overflow-hidden rounded-full bg-s-line"
          aria-hidden="true"
        >
          <span
            className="block h-full origin-left rounded-full bg-s-teal transition-transform duration-500 ease-out"
            style={{ transform: `scaleX(${progress})` }}
          />
        </span>
      </div>
      {questions.map(({ key, text }) => {
        const answered = Boolean(answers[key]?.trim());
        return (
          <div key={key} className={`question-field ${answered ? 'is-answered' : ''}`}>
            <AuthField
              name={`answer-${key}`}
              label={tr(text)}
              autoComplete="off"
              icon={answered ? <Check size={16} /> : <KeyRound size={16} />}
              value={answers[key] ?? ''}
              onChange={(e) => onChange({ ...answers, [key]: e.target.value })}
            />
          </div>
        );
      })}
    </fieldset>
  );
}

export default SecurityQuestionsFields;
