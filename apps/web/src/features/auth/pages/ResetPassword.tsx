import { useLanguage, translate as tr } from '../../../i18n';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { resetPasswordSchema } from '@fraud/shared';
import { api } from '../../../api/client';
import {
  AuthError,
  AuthField,
  AuthForm,
  authButtonClass,
  errorMessage,
  useDeadline,
  validationMessage,
} from '../components/AuthForm';
import { PasswordStrength } from '../components/PasswordStrength';

type TokenCheck =
  { valid: true; expiresAt: string; userName: string } | { valid: false; reason?: string };
export function ResetPassword() {
  useLanguage();
  const { token = '' } = useParams<{ token: string }>();
  const [check, setCheck] = useState<TokenCheck | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const remaining = useDeadline(check?.valid ? Date.parse(check.expiresAt) : 0);
  useEffect(() => {
    let active = true;
    setCheck(null);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
    api<TokenCheck>(`/auth/reset-password/${encodeURIComponent(token)}`)
      .then((result) => {
        if (active) setCheck(result);
      })
      .catch((e: unknown) => {
        if (active) {
          setError(errorMessage(e));
          setCheck({ valid: false });
        }
      });
    return () => {
      active = false;
    };
  }, [token]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !remaining) return;
    const result = resetPasswordSchema.safeParse({ token, password, confirmPassword });
    if (!result.success) {
      setError(validationMessage(result));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await api<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: result.data,
      });
      setSuccess(response.message);
      setPassword('');
      setConfirmPassword('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthForm
      title={tr('Reset password')}
      subtitle={tr(check?.valid ? `Choose a new password for ${check.userName}.` : undefined)}
    >
      <AuthError message={error} />
      {success ? (
        <div role="status">
          <p>{tr(success)}</p>
          <Link className="text-s-teal" to="/login">
            {tr('Sign in')}
          </Link>
        </div>
      ) : !check ? (
        <p role="status">{tr('Checking reset link…')}</p>
      ) : !check.valid || remaining <= 0 ? (
        <div className="space-y-4">
          <p role="status">
            {tr(
              !check.valid
                ? (check.reason ?? 'This reset link is invalid.')
                : 'This reset link has expired.',
            )}
          </p>
          <Link className="text-s-teal" to="/forgot-password">
            {tr('Request new reset')}
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-s-amber">
            {tr(
              `Link expires in ${Math.floor(remaining / 60)} minutes and ${remaining % 60} seconds.`,
            )}
          </p>
          <form onSubmit={submit} className="space-y-4">
            <AuthField
              name="password"
              label={tr('New password')}
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={busy}
            />
            <PasswordStrength password={password} />
            <AuthField
              name="confirmPassword"
              label={tr('Confirm password')}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={busy}
            />
            {confirmPassword && (
              <p
                role="status"
                className={password === confirmPassword ? 'text-s-teal' : 'text-s-amber'}
              >
                {tr(password === confirmPassword ? 'Passwords match' : 'Passwords do not match')}
              </p>
            )}
            <button className={`${authButtonClass} w-full`} disabled={busy}>
              {tr(busy ? 'Updating…' : 'Reset password')}
            </button>
          </form>
        </>
      )}
    </AuthForm>
  );
}
export default ResetPassword;
