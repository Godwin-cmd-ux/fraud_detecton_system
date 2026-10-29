import { useLanguage, translate as tr } from '../../../i18n';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import type { Principal } from '@fraud/shared';
import { api } from '../../../api/client';
import {
  AuthError,
  AuthField,
  AuthForm,
  authButtonClass,
  errorMessage,
  lockDeadline,
  useDeadline,
} from '../components/AuthForm';

export function Login() {
  useLanguage();
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deadline, setDeadline] = useState(0);
  const remaining = useDeadline(deadline);
  const navigate = useNavigate();
  const queries = useQueryClient();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || remaining) return;
    setBusy(true);
    setError('');
    try {
      const principal = await api<Principal>('/auth/login', {
        method: 'POST',
        body: { role, login, password },
      });
      await queries.invalidateQueries();
      navigate(principal.kind === 'admin' ? '/admin/dashboard' : '/app/dashboard', {
        replace: true,
      });
    } catch (e) {
      setError(errorMessage(e));
      setDeadline(lockDeadline(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthForm
      title={tr('Sign in')}
      subtitle={tr('Secure access to your wallet and fraud monitoring.')}
    >
      <div role="group" aria-label={tr('Account type')} className="mb-5 flex gap-3">
        {(['user', 'admin'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={role === value}
            disabled={busy || remaining > 0}
            className="rounded-lg border border-s-line px-4 py-2"
            onClick={() => {
              setRole(value);
              setLogin('');
              setError('');
            }}
          >
            {tr(value === 'user' ? 'User' : 'Admin')}
          </button>
        ))}
      </div>
      <AuthError message={error} />
      {remaining > 0 && (
        <p role="status" className="mb-4 text-s-amber">
          {tr(`Try again in ${Math.floor(remaining / 60)}m ${remaining % 60}s.`)}
        </p>
      )}
      <form onSubmit={submit} className="space-y-4">
        <AuthField
          name="login"
          label={tr(role === 'admin' ? 'Username or Email' : 'Email, Phone or Card Number')}
          placeholder={tr(role === 'admin' ? 'Username or email' : 'Email, phone or card number')}
          autoComplete="username"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          required
          disabled={busy || remaining > 0}
        />
        <AuthField
          name="password"
          label={tr('Password')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={busy || remaining > 0}
        />
        <button className={`${authButtonClass} w-full`} disabled={busy || remaining > 0}>
          {tr(remaining ? '🔒 Account Locked - Please wait' : busy ? 'Signing in…' : 'Sign in')}
        </button>
      </form>
      <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm text-s-teal">
        <Link to="/forgot-password">{tr('Forgot password?')}</Link>
        <Link to="/register">{tr('Create account')}</Link>
      </div>
    </AuthForm>
  );
}
export default Login;
