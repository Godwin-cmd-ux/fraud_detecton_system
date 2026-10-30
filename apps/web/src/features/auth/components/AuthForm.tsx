import { useLanguage, translate as tr } from '../../../i18n';
import { useEffect, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { ApiError, api } from '../../../api/client';
import { LanguageSwitcher } from '../../../i18n/LanguageSwitcher';
import { localizeValidity } from '../../../i18n/validation';
import { ShieldCheck, ArrowLeft, ArrowUpRight, Fingerprint } from 'lucide-react';

export const authInputClass =
  'w-full rounded-lg border border-s-line bg-s-bg px-3 py-3 text-s-text focus:outline-none focus:ring-2 focus:ring-s-teal';
export const authButtonClass =
  'rounded-lg bg-s-teal px-5 py-3 font-semibold text-s-bg disabled:cursor-not-allowed disabled:opacity-50';

export function AuthForm({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  useLanguage();
  return (
    <main className="auth-page theme-sentinel min-h-screen text-s-text">
      <aside className="auth-story hidden lg:flex">
        <Link to="/" className="flex items-center gap-3 text-xl font-semibold">
          <ShieldCheck size={28} />
          Sentinel
          <span className="ml-1 text-xs font-normal text-white/50">
            / {tr('Fraud Detection System')}
          </span>
        </Link>
        <div className="my-auto py-16">
          <div className="auth-emblem mb-10">
            <Fingerprint size={72} strokeWidth={1} />
          </div>
          <p className="mb-5 text-xs font-medium tracking-[.18em] uppercase text-s-teal">
            {tr('Built around your wallet')}
          </p>
          <h2 className="max-w-md text-5xl leading-[1.12] font-medium tracking-tight">
            {tr('A clearer view of every transaction.')}
          </h2>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-white/60">
            {tr('Secure access to your wallet and fraud monitoring.')}
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-white/15 pt-6 text-xs text-white/50">
          <span>{tr('Sentinel · Fraud Detection System')}</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </div>
      </aside>
      <div className="auth-content px-5 py-8 sm:px-10">
        <div className="auth-topbar mx-auto flex w-full max-w-lg items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-s-dim">
            <ArrowLeft size={16} aria-hidden="true" />
            {tr('Sentinel')}
          </Link>
          <LanguageSwitcher dark />
        </div>
        <div className="auth-form mx-auto w-full max-w-lg py-12 sm:py-16">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ShieldCheck size={32} className="text-s-teal" aria-hidden="true" />
          </div>
          <h1 className="mt-6 font-display text-4xl font-medium tracking-tight">{tr(title)}</h1>
          {subtitle && <p className="mt-3 leading-relaxed text-s-dim">{tr(subtitle)}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </main>
  );
}

export function AuthField({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  useLanguage();
  const id = props.id ?? props.name;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {tr(label)}
      </label>
      <input
        {...props}
        id={id}
        className={authInputClass}
        onInvalid={(event) => {
          localizeValidity(event.currentTarget);
          props.onInvalid?.(event);
        }}
        onInput={(event) => {
          event.currentTarget.setCustomValidity('');
          props.onInput?.(event);
        }}
      />
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  useLanguage();
  return message ? (
    <p
      role="alert"
      className="mb-4 whitespace-pre-line rounded-lg border border-s-red p-3 text-s-red"
    >
      {tr(message)}
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
