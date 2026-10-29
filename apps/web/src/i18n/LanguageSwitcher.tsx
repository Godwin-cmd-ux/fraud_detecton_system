import { useLanguage } from './index';

export function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const { language, setLanguage, tr } = useLanguage();
  return (
    <label
      className={`no-print inline-flex shrink-0 items-center gap-2 text-sm ${dark ? 'text-white' : ''}`}
    >
      <span aria-hidden="true">🌐</span>
      <span>{tr('Language')}</span>
      <select
        aria-label={tr('Language')}
        value={language}
        onChange={(event) => setLanguage(event.target.value === 'sw' ? 'sw' : 'en')}
        className={`min-h-10 rounded-lg border px-2 py-1 text-sm ${dark ? 'border-white/30 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-900'}`}
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="sw" lang="sw">
          Kiswahili
        </option>
      </select>
    </label>
  );
}
