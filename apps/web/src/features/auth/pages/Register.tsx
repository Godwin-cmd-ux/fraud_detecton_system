import { useLanguage, translate as tr } from '../../../i18n';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { registerSchema } from '@fraud/shared';
import { api } from '../../../api/client';
import {
  AuthError,
  AuthField,
  AuthForm,
  authButtonClass,
  errorMessage,
  useQuestions,
  validationMessage,
} from '../components/AuthForm';
import { PasswordStrength } from '../components/PasswordStrength';
import { SecurityQuestionsFields } from '../components/SecurityQuestionsFields';

export function Register() {
  useLanguage();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    cardNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { questions, error: questionError, loading } = useQuestions();
  function submit(event: FormEvent) {
    event.preventDefault();
    const result = registerSchema.safeParse({ ...form, answers });
    if (!result.success) {
      setError(validationMessage(result));
      return;
    }
    setError('');
    setConfirm(true);
  }
  async function createAccount() {
    if (busy) return;
    const result = registerSchema.safeParse({ ...form, answers });
    if (!result.success) {
      setError(validationMessage(result));
      setConfirm(false);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await api<{ message: string }>('/auth/register', {
        method: 'POST',
        body: result.data,
      });
      setSuccess(response.message);
      setForm({
        fullName: '',
        email: '',
        phone: '',
        cardNumber: '',
        password: '',
        confirmPassword: '',
      });
      setAnswers({});
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }
  const change = (key: keyof typeof form, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  return (
    <AuthForm
      title={tr('Create account')}
      subtitle={tr('Your account will be reviewed by an administrator before you can sign in.')}
    >
      {success ? (
        <div role="status" className="space-y-4">
          <p>{tr(success)}</p>
          <Link className="text-s-teal" to="/login">
            {tr('Continue to sign in')}
          </Link>
        </div>
      ) : (
        <>
          <AuthError message={error || questionError} />
          <form onSubmit={submit} className="space-y-4">
            <fieldset disabled={busy || confirm} className="space-y-4">
              <AuthField
                name="fullName"
                label={tr('Full name')}
                autoComplete="name"
                value={form.fullName}
                onChange={(e) => change('fullName', e.target.value)}
                required
                minLength={3}
              />
              <AuthField
                name="email"
                label={tr('Email')}
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => change('email', e.target.value)}
                required
              />
              <AuthField
                name="phone"
                label={tr('Phone number')}
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => change('phone', e.target.value)}
                required
              />
              <AuthField
                name="cardNumber"
                label={tr('Card number')}
                inputMode="numeric"
                autoComplete="cc-number"
                maxLength={24}
                value={form.cardNumber}
                onChange={(e) =>
                  change(
                    'cardNumber',
                    e.target.value
                      .replace(/\D/g, '')
                      .slice(0, 20)
                      .replace(/(.{4})/g, '$1 ')
                      .trim(),
                  )
                }
                required
              />
              <AuthField
                name="password"
                label={tr('Password')}
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={form.password}
                onChange={(e) => change('password', e.target.value)}
                required
              />
              <PasswordStrength password={form.password} />
              <AuthField
                name="confirmPassword"
                label={tr('Confirm password')}
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => change('confirmPassword', e.target.value)}
                required
              />
              {form.confirmPassword && (
                <p
                  role="status"
                  className={
                    form.password === form.confirmPassword ? 'text-s-teal' : 'text-s-amber'
                  }
                >
                  {tr(
                    form.password === form.confirmPassword
                      ? 'Passwords match'
                      : 'Passwords do not match',
                  )}
                </p>
              )}
              {loading ? (
                <p role="status">{tr('Loading security questions…')}</p>
              ) : (
                <SecurityQuestionsFields
                  questions={questions}
                  answers={answers}
                  onChange={setAnswers}
                />
              )}
            </fieldset>
            <button
              className={`${authButtonClass} w-full`}
              disabled={busy || confirm || loading || !!questionError || questions.length < 3}
            >
              {tr('Create account')}
            </button>
          </form>
          {confirm && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="register-confirm"
              className="mt-5 rounded-lg border border-s-teal bg-s-panel2 p-4"
            >
              <h2 id="register-confirm" className="font-semibold">
                {tr('Confirm registration')}
              </h2>
              <p className="my-3">{tr('Create your account with the details provided?')}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  className={authButtonClass}
                  disabled={busy}
                  onClick={createAccount}
                  autoFocus
                >
                  {tr(busy ? 'Creating…' : 'Confirm registration')}
                </button>
                <button type="button" disabled={busy} onClick={() => setConfirm(false)}>
                  {tr('Cancel')}
                </button>
              </div>
            </div>
          )}
          <p className="mt-5 text-sm">
            {tr('Already registered? ')}
            <Link to="/login" className="text-s-teal">
              {tr('Sign in')}
            </Link>
          </p>
        </>
      )}
    </AuthForm>
  );
}
export default Register;
