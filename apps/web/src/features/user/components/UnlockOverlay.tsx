import { useLanguage, translate as tr } from '../../../i18n';
import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import type { FormEvent } from 'react';
import { ApiError } from '../../../api/client';
import { useUnlockTransactions } from '../../../api/me';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

/** Glass overlay shown while the transaction list is locked; unlocks with the account password. */
export function UnlockOverlay() {
  useLanguage();
  const unlock = useUnlockTransactions();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    unlock.mutate(password, {
      onError: (err) => {
        setError(
          err instanceof ApiError && err.status === 401
            ? 'Incorrect password. Please try again.'
            : err.message,
        );
      },
      onSuccess: () => setPassword(''),
    });
  }

  return (
    <div className="relative min-h-[320px] overflow-hidden rounded-card border border-p-border bg-white">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-p-bg to-white opacity-80 blur-sm" />
      <div className="relative mx-auto flex max-w-sm flex-col items-center gap-4 px-6 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-p-primary/8 text-p-primary">
          <LockKeyhole size={26} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h2 className="text-lg font-semibold tracking-tight text-p-dark">
          {tr('Transactions Locked')}
        </h2>
        <p className="text-sm text-p-muted">
          {tr(
            'Enter your password to view your transaction history. The list will automatically lock after 5 minutes of inactivity.',
          )}
        </p>
        <form onSubmit={submit} className="flex w-full flex-col gap-3">
          <Input
            label={tr('Password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error && <Alert kind="error">{tr(error)}</Alert>}
          <Button type="submit" loading={unlock.isPending}>
            {tr('Unlock Transactions')}
          </Button>
        </form>
      </div>
    </div>
  );
}
