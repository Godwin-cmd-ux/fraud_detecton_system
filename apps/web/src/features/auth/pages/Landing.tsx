import { useLanguage, translate as tr } from '../../../i18n';
import { Link } from 'react-router';
import { formatTsh } from '../../../lib/format';
import { LanguageSwitcher } from '../../../i18n/LanguageSwitcher';
import { ShieldCheck, ArrowUpRight, Wallet, ScanLine, ListChecks } from 'lucide-react';

interface Activity {
  id: number;
  amount: number;
  status: string;
  score?: number;
}
export function Landing() {
  useLanguage();
  const activity: Activity[] = [
    { id: 1, amount: 125_000, status: 'Cleared', score: 12 },
    { id: 2, amount: 2_500_000, status: 'Flagged', score: 86 },
    { id: 3, amount: 50_000, status: 'Scanning' },
  ];
  return (
    <main className="landing-page theme-sentinel min-h-screen bg-s-bg text-s-text">
      <nav
        aria-label={tr('Main navigation')}
        className="site-nav mx-auto grid max-w-6xl grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-3"
      >
        <Link to="/" className="site-nav__brand font-display text-xl font-bold text-s-teal">
          <span className="site-nav__mark" aria-hidden="true">
            <ShieldCheck size={20} strokeWidth={2.5} />
          </span>
          {tr('Sentinel')}
        </Link>
        <div className="site-nav__links flex items-center justify-self-end text-sm">
          <a href="#how-it-works">{tr('How it works')}</a>
          <a href="#capabilities">{tr('Capabilities')}</a>
          <Link to="/register">{tr('Create account')}</Link>
        </div>
        <LanguageSwitcher dark pill />
        <Link to="/login" className="site-nav__login text-s-teal">
          {tr('Sign in')}
        </Link>
      </nav>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <p className="mb-4 font-mono text-sm uppercase tracking-widest text-s-teal">
            {tr('Fraud Detection System')}
          </p>
          <h1 className="font-display text-5xl font-bold leading-tight sm:text-6xl">
            {tr('A clearer view of every transaction.')}
          </h1>
          <p className="mt-6 max-w-lg text-lg text-s-dim">
            {tr(
              'Send money, manage your wallet, and spot suspicious activity with rule checks and machine learning working together.',
            )}
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-3 rounded-md bg-s-teal px-6 py-3.5 font-medium text-s-bg"
            >
              {tr('Create your account')}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-md border border-s-line px-6 py-3.5"
            >
              {tr('Sign in')}
            </Link>
          </div>
        </div>
        <div className="screening-panel rounded-2xl border border-s-line bg-s-panel p-6">
          <div className="mb-5 flex justify-between">
            <h2 className="font-semibold">{tr('Transaction screening')}</h2>
            <span className="text-sm text-s-dim">{tr('Illustrative demo')}</span>
          </div>
          <ul aria-label={tr('Illustrative transaction activity')} className="space-y-2">
            {activity.map((row) => (
              <li
                key={row.id}
                className="flex justify-between gap-3 rounded-lg bg-s-panel2 p-3 font-mono text-sm"
              >
                <span>{formatTsh(row.amount)}</span>
                <span
                  className={
                    row.status === 'Flagged'
                      ? 'text-s-red'
                      : row.status === 'Scanning'
                        ? 'text-s-amber'
                        : 'text-s-teal'
                  }
                >
                  {tr(row.status)}
                  {tr(row.score === undefined ? '' : ` · ${row.score}%`)}
                </span>
              </li>
            ))}
          </ul>
          <p className="screening-summary">
            {tr('Combine model risk scores with fraud rules and administrator review.')}
          </p>
        </div>
      </section>
      <section id="capabilities" className="capabilities-section mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-8 font-display text-3xl font-bold">{tr('Built around your wallet')}</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            [
              'Move money',
              'Send funds and make withdrawals in Tanzanian shillings, with a clear transaction history.',
            ],
            [
              'Recognize patterns',
              'Check transaction volume, unusual locations, and repeated failed withdrawals.',
            ],
            [
              'Review the signals',
              'Combine model risk scores with fraud rules and administrator review.',
            ],
          ].map(([title, body], index) => (
            <article
              key={title}
              className="capability-card rounded-xl border border-s-line bg-s-panel p-6"
            >
              <span className="capability-icon" aria-hidden="true">
                {index === 0 ? (
                  <Wallet size={26} />
                ) : index === 1 ? (
                  <ScanLine size={26} />
                ) : (
                  <ListChecks size={26} />
                )}
              </span>
              <h3 className="mb-3 text-xl font-semibold">{tr(title)}</h3>
              <p className="text-s-dim">{tr(body)}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="mb-8 font-display text-3xl font-bold">{tr('How screening works')}</h2>
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            'Submit a transaction',
            'Check recent activity',
            'Evaluate risk signals',
            'Record the outcome',
          ].map((text, index) => (
            <li key={text} className="rounded-xl border border-s-line p-5">
              <span className="mb-3 block font-mono text-s-teal">0{index + 1}</span>
              {tr(text)}
            </li>
          ))}
        </ol>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="closing-panel rounded-xl p-8 sm:p-12">
          <h2 className="mb-4 text-3xl font-bold">{tr('Get started with Sentinel')}</h2>
          <p className="mb-6 text-s-dim">
            {tr('Create an account, complete administrator approval, and access your wallet.')}
          </p>
          <Link
            to="/register"
            className="inline-block inline-flex items-center justify-center gap-3 rounded-md bg-s-teal px-6 py-3.5 font-medium text-s-bg"
          >
            {tr('Create account')}
          </Link>
        </div>
      </section>
      <footer className="mx-auto max-w-6xl px-6 pb-8 text-sm text-s-dim">
        {tr('Sentinel · Fraud Detection System')}
      </footer>
    </main>
  );
}
export default Landing;
