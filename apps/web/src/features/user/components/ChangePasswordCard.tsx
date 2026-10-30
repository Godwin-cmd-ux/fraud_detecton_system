import { useState } from 'react';
import type { FormEvent } from 'react';
import { useChangePassword } from '../../../api/me';
import { useLanguage, translate as tr } from '../../../i18n';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Card } from '../../../components/ui/Table';

/**
 * The website is the only place a USSD-registered customer can replace the phone number that acts
 * as their first password, so the control sits on the dashboard instead of behind another menu.
 * The USSD transaction PIN is separate and is not touched here.
 */
export function ChangePasswordCard() {
  useLanguage();
  const change = useChangePassword();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  function close() {
    setOpen(false);
    setError('');
    setCurrent('');
    setNext('');
    setConfirm('');
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (next !== confirm) {
      setError('Passwords do not match');
      return;
    }
    change.mutate(
      { currentPassword: current, newPassword: next, confirmPassword: confirm },
      {
        onSuccess: () => {
          close();
          setDone(true);
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  return (
    <>
      <Card
        className="mt-6"
        title={tr('Security')}
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setDone(false);
              setOpen(true);
            }}
          >
            {tr('Change password')}
          </Button>
        }
      >
        <p className="text-p-muted">
          {tr('Registered by USSD? Your phone number is your first password — choose your own here.')}
        </p>
        <p className="mt-1 text-xs text-p-muted">
          {tr('Your USSD transaction PIN is separate and stays unchanged.')}
        </p>
        {done && (
          <Alert kind="success" className="mt-4">
            {tr('Password changed. Use your new password the next time you sign in.')}
          </Alert>
        )}
      </Card>

      <Modal open={open} onClose={close} title={tr('Change password')} size="sm">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Input
            label={tr('Current password')}
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
          <Input
            label={tr('New password')}
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            hint={tr('At least 6 characters.')}
          />
          <Input
            label={tr('Confirm new password')}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          {error && <Alert kind="error">{tr(error)}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>
              {tr('Cancel')}
            </Button>
            <Button type="submit" loading={change.isPending}>
              {tr('Save password')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
