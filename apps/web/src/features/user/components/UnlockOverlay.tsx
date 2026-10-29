import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '../../../api/client';
import { useUnlockTransactions } from '../../../api/me';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

/** Glass overlay shown while the transaction list is locked; unlocks with the account password. */
export function UnlockOverlay() {
  const unlock = useUnlockTransactions();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    unlock.mutate(password, {
      onError: (err) => {
        setError(err instanceof ApiError && err.status === 401 ? '❌ Incorrect password. Please try again.' : err.message);
      },
      onSuccess: () => setPassword(''),
    });
  }

  return (
    <div className="relative min-h-[320px] overflow-hidden rounded-card border border-p-border bg-white">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-p-bg to-white opacity-80 blur-sm" />
      <div className="relative mx-auto flex max-w-sm flex-col items-center gap-4 px-6 py-12 text-center">
        <div className="text-4xl">🔒</div>
        <h2 className="text-lg font-bold text-p-dark">Transactions Locked</h2>
        <p className="text-sm text-p-muted">Enter your password to view your transaction history. The list will automatically lock after 5 minutes of inactivity.</p>
        <form onSubmit={submit} className="flex w-full flex-col gap-3">
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          {error && <Alert kind="error">{error}</Alert>}
          <Button type="submit" loading={unlock.isPending}>
            🔓 Unlock Transactions
          </Button>
        </form>
      </div>
    </div>
  );
}
