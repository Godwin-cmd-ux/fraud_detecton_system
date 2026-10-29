import { useLanguage, translate as tr } from '../../../i18n';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { adminSignupSchema } from '@fraud/shared';
import { api } from '../../../api/client';
import {
  AuthError,
  AuthField,
  AuthForm,
  authButtonClass,
  errorMessage,
  validationMessage,
} from '../components/AuthForm';
import { PasswordStrength } from '../components/PasswordStrength';

export function AdminSignup() {
  useLanguage();
  const [firstAdmin, setFirstAdmin] = useState<boolean | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    secretKey: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api<{ firstAdmin: boolean }>('/auth/admin-signup/status')
      .then((result) => {
        if (active) setFirstAdmin(result.firstAdmin);
      })
      .catch((e: unknown) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || firstAdmin === null) return;
    const result = adminSignupSchema.safeParse(form);
    if (!result.success) {
      setError(validationMessage(result));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await api<{ message: string }>('/auth/admin-signup', {
        method: 'POST',
        body: result.data,
      });
      setSuccess(response.message);
      setForm({
        fullName: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        secretKey: '',
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const change = (key: keyof typeof form, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const rules = [
    ['At least 8 characters', form.password.length >= 8],
    ['An uppercase letter', /[A-Z]/.test(form.password)],
    ['A lowercase letter', /[a-z]/.test(form.password)],
    ['A number', /\d/.test(form.password)],
    ['A special character', /[!@#$%^&*(),.?":{}|<>]/.test(form.password)],
  ] as const;
  return (
    <AuthForm title={tr('Admin signup')} subtitle={tr('Create an administrator account.')}>
      <AuthError message={error} />
      {success ? (
        <div role="status">
          <p>{tr(success)}</p>
          <Link to="/login" className="text-s-teal">
            {tr('Sign in')}
          </Link>
        </div>
      ) : (
        <>
          {firstAdmin === null && !error && <p role="status">{tr('Checking setup status…')}</p>}
          {firstAdmin && (
            <p role="status" className="mb-5 rounded-lg border border-s-teal p-3">
              {tr(
                'First Time Setup: create the first administrator account. No setup key is required.',
              )}
            </p>
          )}
          <form onSubmit={submit} className="space-y-4">
            <fieldset disabled={busy || firstAdmin === null} className="space-y-4">
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
                name="username"
                label={tr('Username')}
                autoComplete="username"
                value={form.username}
                onChange={(e) => change('username', e.target.value)}
                required
                pattern="[A-Za-z0-9_]{3,}"
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
                name="password"
                label={tr('Password')}
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => change('password', e.target.value)}
                required
                minLength={8}
              />
              <PasswordStrength password={form.password} />
              <ul className="space-y-1 text-sm" aria-label={tr('Password requirements')}>
                {rules.map(([label, met]) => (
                  <li key={label} className={met ? 'text-s-teal' : 'text-s-dim'}>
                    {tr(met ? '✓' : '○')} {tr(label)}
                  </li>
                ))}
              </ul>
              <AuthField
                name="confirmPassword"
                label={tr('Confirm password')}
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => change('confirmPassword', e.target.value)}
                required
              />
              {firstAdmin === false && (
                <AuthField
                  name="secretKey"
                  label={tr('Admin setup key')}
                  type="password"
                  autoComplete="off"
                  value={form.secretKey}
                  onChange={(e) => change('secretKey', e.target.value)}
                  required
                />
              )}
            </fieldset>
            <button className={`${authButtonClass} w-full`} disabled={busy || firstAdmin === null}>
              {tr(busy ? 'Creating…' : 'Create admin account')}
            </button>
          </form>
          <p className="mt-5">
            <Link to="/login" className="text-s-teal">
              {tr('Back to sign in')}
            </Link>
          </p>
        </>
      )}
    </AuthForm>
  );
}
export default AdminSignup;
