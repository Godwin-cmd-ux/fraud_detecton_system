import { useLanguage, translate as tr } from '../../../i18n';
import { useEffect, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { ApiError, api } from '../../../api/client';
import { LanguageSwitcher } from '../../../i18n/LanguageSwitcher';
import { localizeValidity } from '../../../i18n/validation';
import { plainText } from '../../../lib/text';
import { ShieldCheck, ArrowLeft, ArrowUpRight, Fingerprint, Eye, EyeOff } from 'lucide-react';

export const authInputClass =
  'w-full rounded-[10px] border border-s-line bg-s-bg px-3.5 py-3 text-s-text focus:border-s-teal focus:outline-none focus:ring-4 focus:ring-s-teal/10';
export const authButtonClass =
  'rounded-[10px] bg-s-teal px-5 py-3 font-medium text-s-bg shadow-sm shadow-s-teal/20 disabled:cursor-not-allowed disabled:opacity-50';

export function AuthForm({
  title,
  subtitle,
  aside,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Replaces the default story in the dark side panel. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  useLanguage();
  return (
    <main className="auth-page theme-sentinel min-h-screen text-s-text">
      <aside className="auth-story hidden lg:flex">
        <span className="auth-rings" aria-hidden="true" />
        <Link to="/" className="flex items-center gap-3 text-lg font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-s-teal/12 text-s-teal">
            <ShieldCheck size={20} aria-hidden="true" />
          </span>
          Sentinel
          <span className="ml-1 text-xs font-normal text-white/50">
            / {tr('Fraud Detection System')}
          </span>
        </Link>
        {aside ?? (
          <div className="my-auto py-16">
            <div className="auth-emblem mb-10">
              <Fingerprint size={72} strokeWidth={1} />
            </div>
            <p className="eyebrow mb-5 flex">{tr('Built around your wallet')}</p>
            <h2 className="max-w-md text-5xl leading-[1.08] font-medium tracking-[-0.03em]">
              {tr('A clearer view of every transaction.')}
            </h2>
            <p className="mt-6 max-w-sm text-base leading-relaxed text-white/60">
              {tr('Secure access to your wallet and fraud monitoring.')}
            </p>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-white/15 pt-6 text-xs text-white/50">
          <span>{tr('Sentinel · Fraud Detection System')}</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </div>
      </aside>
      <div className="auth-content px-5 py-8 sm:px-10">
        <div className="auth-topbar mx-auto flex w-full max-w-lg items-center justify-between gap-4">
          <Link
            to="/"
            className="group inline-flex items-center gap-2 text-sm text-s-dim transition hover:text-s-text"
          >
            <ArrowLeft
              size={16}
              className="transition-transform group-hover:-translate-x-0.5"
              aria-hidden="true"
            />
            {tr('Sentinel')}
          </Link>
          <LanguageSwitcher dark />
        </div>
        <div className="auth-form mx-auto w-full max-w-lg py-12 sm:py-16">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-s-teal/10 text-s-teal">
            <ShieldCheck size={22} aria-hidden="true" />
          </span>
          <h1 className="mt-6 font-display text-[2.1rem] font-medium tracking-[-0.025em]">
            {tr(title)}
          </h1>
          {subtitle && <p className="mt-3 leading-relaxed text-s-dim">{tr(subtitle)}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </main>
  );
}

export function AuthField({
  label,
  icon,
  revealable = false,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Decorative leading icon. */
  icon?: ReactNode;
  /** Adds a show/hide toggle for password fields. */
  revealable?: boolean;
}) {
  useLanguage();
  const [revealed, setRevealed] = useState(false);
  const id = props.id ?? props.name;
  const type = revealable && revealed ? 'text' : props.type;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[13px] font-medium">
        {tr(label)}
      </label>
      <div className="auth-input relative">
        {icon && (
          <span
            className="auth-input__icon pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-s-dim"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <input
          {...props}
          id={id}
          type={type}
          className={`${authInputClass} ${icon ? 'pl-10' : ''} ${revealable ? 'pr-11' : ''}`}
          onInvalid={(event) => {
            localizeValidity(event.currentTarget);
            props.onInvalid?.(event);
          }}
          onInput={(event) => {
            event.currentTarget.setCustomValidity('');
            props.onInput?.(event);
          }}
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={tr(revealed ? 'Hide password' : 'Show password')}
            aria-pressed={revealed}
            aria-controls={id}
            className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-s-dim transition hover:bg-s-panel2 hover:text-s-text"
          >
            {revealed ? (
              <EyeOff size={16} aria-hidden="true" />
            ) : (
              <Eye size={16} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  useLanguage();
  return message ? (
    <p
      role="alert"
      className="animate-slide-down mb-4 whitespace-pre-line rounded-[10px] border border-s-red/25 bg-risk-soft p-3.5 text-sm text-s-red"
    >
      {tr(plainText(message))}
    </p>
  ) : null;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function validationMessage(result: { error: { issues: { message: string }[] } }): string {
  return [...new Set(result.error.issues.map((issue) => issue.message))].join('\n');
}

/** Uses an absolute deadline so a sleeping/background tab does not extend lockout. */
export function useDeadline(deadline: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (!deadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function lockDeadline(error: unknown): number {
  if (!(error instanceof ApiError) || error.status !== 423) return 0;
  const until = Date.parse(error.fields?.lockedUntil ?? '');
  const minutes = Number(error.fields?.minutesRemaining);
  return Number.isFinite(until)
    ? until
    : Date.now() + (Number.isFinite(minutes) && minutes > 0 ? minutes : 5) * 60_000;
}

export interface SecurityQuestion {
  key: string;
  text: string;
}
export function useQuestions() {
  const [questions, setQuestions] = useState<SecurityQuestion[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api<SecurityQuestion[]>('/security-questions')
      .then((rows) => {
        if (active) setQuestions(rows);
      })
      .catch((e: unknown) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return { questions, error, loading };
}
