import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../../api/client';
import { AuthError, AuthField, AuthForm, authButtonClass, errorMessage, lockDeadline, useDeadline } from '../components/AuthForm';
import type { SecurityQuestion } from '../components/AuthForm';
import { SecurityQuestionsFields } from '../components/SecurityQuestionsFields';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [questions, setQuestions] = useState<SecurityQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deadline, setDeadline] = useState(0);
  const remaining = useDeadline(deadline);
  const navigate = useNavigate();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || remaining) return;
    setBusy(true); setError('');
    try {
      if (questions === null) {
        const result = await api<{ questions: SecurityQuestion[] }>('/auth/forgot-password/start', { method: 'POST', body: { email } });
        setQuestions(result.questions); setAnswers({});
      } else {
        const body = Object.fromEntries(Object.entries(answers).filter(([, answer]) => answer.trim()));
        if (Object.keys(body).length < 3) { setError('Please answer at least 3 security questions'); return; }
        const result = await api<{ token: string; expiresAt: string }>('/auth/forgot-password/verify', { method: 'POST', body: { answers: body } });
        navigate(`/reset-password/${encodeURIComponent(result.token)}`, { replace: true });
      }
    } catch (e) { setError(errorMessage(e)); setDeadline(lockDeadline(e)); }
    finally { setBusy(false); }
  }
  return <AuthForm title="Recover your account" subtitle={questions ? 'Answer your security questions to reset your password.' : 'Enter the email address linked to your account.'}>
    <AuthError message={error} />
    {remaining > 0 && <p role="status" className="mb-4 text-s-amber">Try again in {Math.floor(remaining / 60)}m {remaining % 60}s.</p>}
    <form onSubmit={submit} className="space-y-5">
      {questions === null ? <AuthField name="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={busy || remaining > 0} /> :
        <><p className="text-sm text-s-dim">Recovering {email}</p><SecurityQuestionsFields questions={questions} answers={answers} onChange={setAnswers} disabled={busy || remaining > 0} /></>}
      <button className={`${authButtonClass} w-full`} disabled={busy || remaining > 0}>{busy ? 'Checking…' : questions ? 'Verify answers' : 'Continue'}</button>
    </form>
    <div className="mt-5 flex justify-between gap-3 text-sm text-s-teal">
      <Link to="/login">Back to sign in</Link>
      {questions && <button type="button" disabled={busy || remaining > 0} onClick={() => { setQuestions(null); setAnswers({}); setError(''); }}>Use another email</button>}
    </div>
  </AuthForm>;
}
export default ForgotPassword;
