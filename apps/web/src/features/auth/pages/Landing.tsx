import { useLanguage, translate as tr } from '../../../i18n';
import { Link } from 'react-router';
import { formatTsh } from '../../../lib/format';
import { useReveal } from '../../../lib/useReveal';
import { PrivacySection } from '../components/landing/PrivacySection';
import { RiskSimulator } from '../components/landing/RiskSimulator';
import { RulesSection } from '../components/landing/RulesSection';
import { LanguageSwitcher } from '../../../i18n/LanguageSwitcher';
import {
  ShieldCheck,
  ArrowUpRight,
  Wallet,
  ScanLine,
  ListChecks,
  Check,
  TriangleAlert,
  LoaderCircle,
  MapPin,
  Sparkles,
} from 'lucide-react';

interface Activity {
  id: number;
  amount: number;
  route: string;
  status: 'Cleared' | 'Flagged' | 'Scanning';
  score?: number;
}

const activity: Activity[] = [
  { id: 1, amount: 125_000, route: 'Dar es Salaam', status: 'Cleared', score: 12 },
  { id: 2, amount: 2_500_000, route: 'Mwanza → Arusha', status: 'Flagged', score: 86 },
  { id: 3, amount: 50_000, route: 'Dodoma', status: 'Scanning' },
];

/** Colour follows meaning: green clears, red flags, amber is still deciding. */
const statusStyle = {
  Cleared: { Icon: Check, color: '#1d7550', soft: '#e4f1e9' },
  Flagged: { Icon: TriangleAlert, color: '#b4383d', soft: '#f9e5e4' },
  Scanning: { Icon: LoaderCircle, color: '#95600f', soft: '#f8eedb' },
} as const;

const capabilities = [
  {
    Icon: Wallet,
    title: 'Move money',
    body: 'Send funds and make withdrawals in Tanzanian shillings, with a clear transaction history.',
  },
  {
    Icon: ScanLine,
    title: 'Recognize patterns',
    body: 'Check transaction volume, unusual locations, and repeated failed withdrawals.',
  },
  {
    Icon: ListChecks,
    title: 'Review the signals',
    body: 'Combine model risk scores with fraud rules and administrator review.',
  },
];

const steps = [
  'Submit a transaction',
  'Check recent activity',
  'Evaluate risk signals',
  'Record the outcome',
];

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  useLanguage();
  return (
    <div className="reveal mb-10 max-w-2xl">
      <p className="eyebrow mb-4">
        <span className="h-px w-8 bg-s-teal/60" aria-hidden="true" />
        {tr(eyebrow)}
      </p>
      <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">{tr(title)}</h2>
      <p className="mt-4 text-[16px] leading-relaxed text-s-dim">{tr(body)}</p>
    </div>
  );
}

function ScreeningPanel() {
  useLanguage();
  return (
    <div className="relative">
      <div className="screening-panel">
        <div className="screening-panel__head">
          <h2 className="text-[15px] font-semibold">{tr('Transaction screening')}</h2>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#eef0eb] px-2.5 py-1 text-[11px] font-medium text-p-muted">
            <span className="live-dot" aria-hidden="true" />
            {tr('Illustrative demo')}
          </span>
        </div>
        <div className="screening-panel__body">
          <span className="screening-scanline" aria-hidden="true" />
          <ul aria-label={tr('Illustrative transaction activity')}>
            {activity.map((row) => {
              const style = statusStyle[row.status];
              return (
                <li
                  key={row.id}
                  className={`screening-row ${row.status === 'Scanning' ? 'screening-row--scanning' : ''}`}
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-[10px]"
                    style={{ background: style.soft, color: style.color }}
                    aria-hidden="true"
                  >
                    <style.Icon
                      size={17}
                      strokeWidth={2.2}
                      className={row.status === 'Scanning' ? 'animate-spin' : undefined}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="tabular block font-mono text-[13px] font-medium text-p-dark">
                      {formatTsh(row.amount)}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-p-muted">
                      <MapPin size={11} aria-hidden="true" />
                      {row.route}
                    </span>
                    <span className="screening-row__meter mt-2 block" aria-hidden="true">
                      <span style={{ width: `${row.score ?? 35}%`, background: style.color }} />
                    </span>
                  </span>
                  <span
                    className="tabular text-right font-mono text-xs font-medium"
                    style={{ color: style.color }}
                  >
                    {tr(row.status)}
                    {row.score !== undefined && (
                      <span className="block text-[11px] opacity-75">{row.score}%</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="screening-panel__foot">
          {tr('Combine model risk scores with fraud rules and administrator review.')}
        </p>
      </div>
      <span className="float-chip -top-5 right-14" aria-hidden="true">
        <ShieldCheck size={14} className="text-s-teal" />
        {tr('Rule checks')}
      </span>
      <span className="float-chip -right-5 -bottom-5 [animation-delay:-3s]" aria-hidden="true">
        <Sparkles size={14} className="text-s-amber" />
        {tr('Model risk score')}
      </span>
    </div>
  );
}

export function Landing() {
  useLanguage();
  const root = useReveal<HTMLElement>();
  return (
    <main ref={root} className="landing-page theme-sentinel min-h-screen bg-s-bg text-s-text">
      <nav
        aria-label={tr('Main navigation')}
        className="site-nav mx-auto grid max-w-6xl grid-cols-[1fr_auto_auto_auto] items-center gap-6 px-6"
      >
        <Link to="/" className="site-nav__brand text-lg font-semibold">
          <span className="site-nav__mark" aria-hidden="true">
            <ShieldCheck size={20} strokeWidth={2.25} />
          </span>
          {tr('Sentinel')}
        </Link>
        <div className="site-nav__links flex items-center justify-self-end text-sm">
          <a href="#try-it">{tr('Try it')}</a>
          <a href="#how-it-works">{tr('How it works')}</a>
          <a href="#security">{tr('Security')}</a>
          <Link to="/register" className="site-nav__extra">
            {tr('Create account')}
          </Link>
        </div>
        <LanguageSwitcher dark pill />
        <Link to="/login" className="site-nav__login">
          {tr('Sign in')}
        </Link>
      </nav>

      <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 pt-14 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-24 lg:pb-28">
        <div className="hero-in">
          <p className="eyebrow mb-6">
            <span className="h-px w-8 bg-s-teal/60" aria-hidden="true" />
            {tr('Fraud Detection System')}
          </p>
          <h1 className="hero-title text-[2.6rem] leading-[1.05] sm:text-6xl">
            {tr('A clearer view of every transaction.')}
          </h1>
          <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-s-dim">
            {tr(
              'Send money, manage your wallet, and spot suspicious activity with rule checks and machine learning working together.',
            )}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/register" className="btn-sage">
              {tr('Create your account')}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <Link to="/login" className="btn-outline-dark">
              {tr('Sign in')}
            </Link>
          </div>
        </div>
        <div className="hero-in [animation-delay:0.15s]">
          <ScreeningPanel />
        </div>
      </section>

      <section id="capabilities" className="capabilities-section">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="reveal mb-10 flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-md text-3xl font-medium tracking-tight sm:text-4xl">
              {tr('Built around your wallet')}
            </h2>
          </div>
          <div className="reveal grid gap-4 md:grid-cols-3">
            {capabilities.map(({ Icon, title, body }) => (
              <article key={title} className="capability-card">
                <span className="capability-icon" aria-hidden="true">
                  <Icon size={22} strokeWidth={1.75} />
                </span>
                <h3 className="mb-2.5 text-xl font-medium tracking-tight">{tr(title)}</h3>
                <p className="leading-relaxed text-s-dim">{tr(body)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="try-it" className="steps-section">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHead
            eyebrow="Try it"
            title="Run a transfer through the checks"
            body="Change the amount, time, location or recent activity and watch the risk score respond, using the same rules as real transfers."
          />
          <div className="reveal">
            <RiskSimulator />
          </div>
        </div>
      </section>

      <section id="rules" className="steps-section">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHead
            eyebrow="What we watch for"
            title="Clear rules, not guesswork"
            body="Each transfer is checked against these patterns before any money moves."
          />
          <RulesSection />
        </div>
      </section>

      <section id="how-it-works" className="steps-section">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="reveal mb-12 text-3xl font-medium tracking-tight sm:text-4xl">
            {tr('How screening works')}
          </h2>
          <ol className="reveal grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((text, index) => (
              <li key={text} className="step">
                <span className="mb-4 block font-mono text-xs tracking-widest text-s-teal">
                  0{index + 1}
                </span>
                <span className="text-lg leading-snug">{tr(text)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="security" className="steps-section">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHead
            eyebrow="Security"
            title="Your money stays private"
            body="Protection that works on your side too, not only against fraudsters."
          />
          <PrivacySection />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="closing-panel reveal p-8 sm:p-14">
          <h2 className="mb-3 max-w-lg text-3xl font-medium tracking-tight sm:text-4xl">
            {tr('Get started with Sentinel')}
          </h2>
          <p className="mb-8 max-w-lg leading-relaxed text-s-bg/75">
            {tr('Create an account, complete administrator approval, and access your wallet.')}
          </p>
          <Link
            to="/register"
            className="inline-flex min-h-12 items-center gap-2.5 rounded-[10px] bg-s-bg px-6 font-medium text-s-text transition hover:bg-[#143b3b]"
          >
            {tr('Create account')}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-7 text-sm text-s-dim">
          <span className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-s-teal" aria-hidden="true" />
            {tr('Sentinel · Fraud Detection System')}
          </span>
          <Link to="/login" className="transition hover:text-white">
            {tr('Sign in')}
          </Link>
        </div>
      </footer>
    </main>
  );
}
export default Landing;
