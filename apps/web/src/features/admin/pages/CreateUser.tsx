import { useLanguage, translate as tr } from '../../../i18n';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { createUserSchema } from '@fraud/shared';
import { useCreateUser } from '../../../api/admin';
import { useSecurityQuestions } from '../../../api/auth';
import { TopHeader } from '../../../components/layout/TopHeader';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Input } from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';
import { Card } from '../../../components/ui/Table';

const groupCard = (v: string) =>
  v
    .replace(/\D/g, '')
    .slice(0, 20)
    .replace(/(.{4})/g, '$1 ')
    .trim();

/** Same scoring as the public registration page: six points, Weak / Medium / Strong. */
export function strengthOf(p: string): { score: number; label: string; color: string } {
  let score = 0;
  if (p.length >= 6) score++;
  if (p.length >= 8) score++;
  if (/[a-z]/.test(p)) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[$@#&!]/.test(p)) score++;
  if (score <= 2) return { score, label: 'Weak', color: '#b4383d' };
  if (score <= 4) return { score, label: 'Medium', color: '#95600f' };
  return { score, label: 'Strong', color: '#1d7550' };
}

const empty = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  initialBalance: '0.00',
  cardNumber: '',
  isApproved: true,
};

export function CreateUserPage() {
  useLanguage();
  const questions = useSecurityQuestions();
  const create = useCreateUser();
  const [form, setForm] = useState(empty);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);

  const answered = Object.values(answers).filter((a) => a.trim()).length;
  const strength = strengthOf(form.password);
  const set = (k: keyof typeof empty, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  function parsed() {
    return createUserSchema.safeParse({
      ...form,
      initialBalance: Number(form.initialBalance),
      answers,
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    const r = parsed();
    if (!r.success) {
      setError(r.error.issues.map((i) => i.message).join('\n'));
      return;
    }
    setConfirming(true);
  }

  function submit() {
    setConfirming(false);
    const r = parsed();
    if (!r.success) return;
    create.mutate(r.data, {
      onSuccess: (res) => {
        setMessage(res.message);
        setForm(empty);
        setAnswers({});
      },
      onError: (err) => setError(err.message),
    });
  }

  return (
    <div>
      <TopHeader title={tr('Create New User')} subtitle={tr('Add a new customer to the system')} />
      <Card title={tr('New customer account')} className="mx-auto max-w-3xl">
        {message && (
          <Alert kind="success" className="mb-4">
            {tr(message)}
          </Alert>
        )}
        {error && (
          <Alert kind="error" className="mb-4">
            {tr(error)}
          </Alert>
        )}
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <Input
            label={tr('Full Name *')}
            value={form.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            required
            minLength={3}
          />
          <Input
            label={tr('Email *')}
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            required
          />
          <Input
            label={tr('Phone *')}
            type="tel"
            placeholder={tr('+255712345678')}
            hint={tr('Tanzanian format: +255XXXXXXXXX')}
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            required
          />
          <Input
            label={tr('Password *')}
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            required
            minLength={6}
            hint={tr(
              form.password ? (
                <span style={{ color: strength.color }} className="font-semibold">
                  {tr('Strength: ')}
                  {tr(strength.label)}
                </span>
              ) : (
                'At least 6 characters'
              ),
            )}
          />
          <Input
            label={tr('Initial Balance (TSh)')}
            type="number"
            step="0.01"
            min="0"
            value={form.initialBalance}
            onChange={(e) => set('initialBalance', e.target.value)}
          />
          <Input
            label={tr('Card Number *')}
            inputMode="numeric"
            maxLength={24}
            value={form.cardNumber}
            onChange={(e) => set('cardNumber', groupCard(e.target.value))}
            hint={tr('16-20 digits')}
            required
          />
          <label className="flex items-center gap-2 text-sm font-semibold text-p-text md:col-span-2">
            <input
              type="checkbox"
              checked={form.isApproved}
              onChange={(e) => set('isApproved', e.target.checked)}
            />
            {tr('Activate account immediately (skip approval)')}
          </label>

          <div className="md:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold text-p-dark">{tr('Security Questions')}</h3>
              <span
                className={`text-sm font-semibold ${answered >= 3 ? 'text-p-success' : 'text-p-warning'}`}
              >
                {Math.min(answered, 3)}
                {tr('/3 answered')}
              </span>
            </div>
            {questions.isPending && <Spinner />}
            <div className="grid gap-3 md:grid-cols-2">
              {questions.data?.map((q) => (
                <Input
                  key={q.key}
                  label={tr(`${q.text} (Optional)`)}
                  value={answers[q.key] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-p-muted">
              {tr('At least 3 answers are required. Answers are case-sensitive.')}
            </p>
          </div>

          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" loading={create.isPending}>
              {tr('Create User')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setForm(empty);
                setAnswers({});
                setError('');
              }}
            >
              {tr('Reset')}
            </Button>
          </div>
        </form>
      </Card>
      <ConfirmDialog
        open={confirming}
        title={tr('Create user?')}
        body={tr(`Create this user account with ${answered} security questions answered?`)}
        confirmText={tr('Create')}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
