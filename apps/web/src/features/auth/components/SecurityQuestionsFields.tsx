import { AuthField } from './AuthForm';
import type { SecurityQuestion } from './AuthForm';

export function SecurityQuestionsFields({ questions, answers, onChange, disabled = false }: {
  questions: SecurityQuestion[]; answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void; disabled?: boolean;
}) {
  const count = questions.filter(({ key }) => answers[key]?.trim()).length;
  return <fieldset disabled={disabled} className="space-y-4">
    <legend className="mb-2 font-semibold">Security questions</legend>
    <p className="text-sm text-s-dim">{count}/3 answered. Answer at least three questions.</p>
    {questions.map(({ key, text }) => <AuthField key={key} name={`answer-${key}`} label={text}
      autoComplete="off" value={answers[key] ?? ''} onChange={(e) => onChange({ ...answers, [key]: e.target.value })} />)}
  </fieldset>;
}

export default SecurityQuestionsFields;
