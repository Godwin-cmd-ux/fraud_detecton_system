import { useLanguage, translate as tr } from '../../../i18n';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router';
import { registerSchema } from '@fraud/shared';
import {
  ArrowRight,
  Check,
  CircleCheck,
  CreditCard,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  Wifi,
} from 'lucide-react';
import { api } from '../../../api/client';
import { plainText } from '../../../lib/text';
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

/** Live preview of the card being registered; digits fill in as they are typed. */
function CardPreview({ name, number }: { name: string; number: string }) {
  useLanguage();
  const digits = number.replace(/\D/g, '').padEnd(16, '•').slice(0, 16);
  const groups = digits.match(/.{4}/g) ?? [];
  return (
    <div className="card-preview" aria-hidden="true">
      <div className="flex items-start justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <ShieldCheck size={16} />
          Sentinel
        </span>
        <Wifi size={18} className="rotate-90 opacity-60" />
      </div>
      <span className="card-preview__chip" />
      <div className="tabular font-mono text-[1.05rem] tracking-[0.14em] sm:text-lg">
        {groups.map((group, index) => (
          <span key={index} className="mr-3 inline-block last:mr-0">
            {group}
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] tracking-[0.16em] uppercase opacity-55">
            {tr('Card holder')}
          </div>
          <div className="truncate text-[13px] font-medium tracking-wide uppercase">
            {name.trim() || tr('Your name')}
          </div>
        </div>
        <span className="text-[11px] font-medium opacity-70">TSh</span>
      </div>
    </div>
  );
}

function RegisterAside({ name, number }: { name: string; number: string }) {
  useLanguage();
  const steps = [
    ['Create your account', 'Fill in your details and security answers.'],
    ['Administrator review', 'We verify new accounts before they go live.'],
    ['Start sending money', 'Sign in to send, withdraw and track activity.'],
  ];
  return (
    <div className="my-auto py-12">
      <CardPreview name={name} number={number} />
      <p className="eyebrow mt-12 mb-6 flex">{tr('Open your wallet in three steps')}</p>
      <ol className="space-y-5">
        {steps.map(([title, body], index) => (
          <li key={title} className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-s-teal/30 font-mono text-xs text-s-teal">
              0{index + 1}
            </span>
            <span>
              <span className="block font-medium">{tr(title)}</span>
              <span className="mt-0.5 block text-sm text-white/55">{tr(body)}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Section({
  index,
  title,
  done,
  children,
}: {
  index: number;
  title: string;
  done: boolean;
  children: ReactNode;
}) {
  useLanguage();
  return (
    <section className="reg-section">
      <h2 className="mb-4 flex items-center gap-3 text-[15px] font-semibold">
        <span className={`reg-step ${done ? 'is-done' : ''}`} aria-hidden="true">
          {done ? <Check size={13} strokeWidth={3} /> : index}
        </span>
        {tr(title)}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

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

  const detailsDone = Boolean(
    form.fullName.trim().length >= 3 &&
    /\S+@\S+\.\S+/.test(form.email) &&
    form.phone.trim() &&
    form.cardNumber.replace(/\D/g, '').length >= 12,
  );
  const passwordsMatch = Boolean(form.confirmPassword) && form.password === form.confirmPassword;
  const securityDone = form.password.length >= 6 && passwordsMatch;
  const answered = questions.filter(({ key }) => answers[key]?.trim()).length;
  const recoveryDone = answered >= 3;
  const cardDigits = form.cardNumber.replace(/\D/g, '');

  return (
    <AuthForm
      title={tr('Create account')}
      subtitle={tr('Your account will be reviewed by an administrator before you can sign in.')}
      aside={<RegisterAside name={form.fullName} number={form.cardNumber} />}
    >
      {success ? (
        <div role="status" className="reg-success text-center sm:text-left">
          <span className="reg-success__icon">
            <CircleCheck size={30} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-xl font-semibold tracking-tight">{tr('Account created')}</h2>
          <p className="mt-2 leading-relaxed text-s-dim">{tr(plainText(success))}</p>
          <Link
            className={`${authButtonClass} mt-7 inline-flex items-center gap-2 text-white`}
            to="/login"
          >
            {tr('Continue to sign in')}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <>
          <ol className="reg-progress mb-8" aria-hidden="true">
            {[detailsDone, securityDone, recoveryDone].map((done, index) => (
              <li key={index} className={done ? 'is-done' : ''} />
            ))}
          </ol>
          <AuthError message={error || questionError} />
          <form onSubmit={submit} className="space-y-4">
            <fieldset disabled={busy || confirm} className="space-y-8">
              <Section index={1} title="Your details" done={detailsDone}>
                <AuthField
                  name="fullName"
                  label={tr('Full name')}
                  autoComplete="name"
                  icon={<UserRound size={16} />}
                  value={form.fullName}
                  onChange={(e) => change('fullName', e.target.value)}
                  required
                  minLength={3}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <AuthField
                    name="email"
                    label={tr('Email')}
                    type="email"
                    autoComplete="email"
                    icon={<Mail size={16} />}
                    value={form.email}
                    onChange={(e) => change('email', e.target.value)}
                    required
                  />
                  <AuthField
                    name="phone"
                    label={tr('Phone number')}
                    type="tel"
                    autoComplete="tel"
                    icon={<Phone size={16} />}
                    placeholder="+255 7XX XXX XXX"
                    value={form.phone}
                    onChange={(e) => change('phone', e.target.value)}
                    required
                  />
                </div>
                <AuthField
                  name="cardNumber"
                  label={tr('Card number')}
                  inputMode="numeric"
                  autoComplete="cc-number"
                  icon={<CreditCard size={16} />}
                  maxLength={24}
                  placeholder="0000 0000 0000 0000"
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
                {cardDigits && (
                  <div className="animate-slide-down lg:hidden">
                    <CardPreview name={form.fullName} number={form.cardNumber} />
                  </div>
                )}
              </Section>

              <Section index={2} title="Sign-in security" done={securityDone}>
                <AuthField
                  name="password"
                  label={tr('Password')}
                  type="password"
                  autoComplete="new-password"
                  icon={<Lock size={16} />}
                  revealable
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
                  icon={<Lock size={16} />}
                  revealable
                  value={form.confirmPassword}
                  onChange={(e) => change('confirmPassword', e.target.value)}
                  required
                />
                {form.confirmPassword && (
                  <p
                    role="status"
                    className={`animate-slide-down flex items-center gap-1.5 text-[13px] ${passwordsMatch ? 'text-s-teal' : 'text-s-amber'}`}
                  >
                    {passwordsMatch && <Check size={14} aria-hidden="true" />}
                    {tr(passwordsMatch ? 'Passwords match' : 'Passwords do not match')}
                  </p>
                )}
              </Section>

              <Section index={3} title="Account recovery" done={recoveryDone}>
                <p className="-mt-2 text-sm text-s-dim">
                  {tr('Used if you ever forget your password.')}
                </p>
                {loading ? (
                  <p role="status" className="text-sm text-s-dim">
                    {tr('Loading security questions…')}
                  </p>
                ) : (
                  <SecurityQuestionsFields
                    questions={questions}
                    answers={answers}
                    onChange={setAnswers}
                  />
                )}
              </Section>
            </fieldset>
            {!confirm && (
              <button
                className={`${authButtonClass} mt-4 w-full`}
                disabled={busy || loading || !!questionError || questions.length < 3}
              >
                {tr('Create account')}
              </button>
            )}
          </form>
          {confirm && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="register-confirm"
              className="reg-confirm mt-6"
            >
              <h2 id="register-confirm" className="font-semibold">
                {tr('Confirm registration')}
              </h2>
              <p className="mt-1 text-sm text-s-dim">
                {tr('Create your account with the details provided?')}
              </p>
              <dl className="my-4 grid gap-x-4 gap-y-2.5 rounded-xl bg-s-panel2 p-4 text-sm sm:grid-cols-2">
                {[
                  ['Full name', form.fullName],
                  ['Email', form.email],
                  ['Phone number', form.phone],
                  ['Card number', `•••• ${cardDigits.slice(-4)}`],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-[11px] tracking-[0.08em] text-s-dim uppercase">
                      {tr(label)}
                    </dt>
                    <dd className="truncate font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={`${authButtonClass} flex-1`}
                  disabled={busy}
                  onClick={createAccount}
                  autoFocus
                >
                  {tr(busy ? 'Creating…' : 'Confirm registration')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirm(false)}
                  className="rounded-[10px] border border-s-line px-5 py-3 font-medium transition hover:bg-s-panel2"
                >
                  {tr('Cancel')}
                </button>
              </div>
            </div>
          )}
          <p className="mt-6 text-center text-sm text-s-dim">
            {tr('Already registered? ')}
            <Link to="/login" className="font-medium text-s-teal hover:underline">
              {tr('Sign in')}
            </Link>
          </p>
        </>
      )}
    </AuthForm>
  );
}
export default Register;
