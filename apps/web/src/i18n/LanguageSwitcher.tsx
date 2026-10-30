import { useLanguage } from './index';
import { Globe2 } from 'lucide-react';

export function LanguageSwitcher({ dark = false, pill = false }: { dark?: boolean; pill?: boolean }) {
  const { language, setLanguage, tr } = useLanguage();
  if (pill) {
    return (
      <div className="language-pill no-print" aria-label={tr('Language')}>
        <button
          type="button"
          className={language === 'en' ? 'is-active' : ''}
          aria-pressed={language === 'en'}
          onClick={() => setLanguage('en')}
        >
          English
        </button>
        <button
          type="button"
          className={language === 'sw' ? 'is-active' : ''}
          aria-pressed={language === 'sw'}
          onClick={() => setLanguage('sw')}
        >
          Kiswahili
        </button>
      </div>
    );
  }
  return (
    <label
      className={`no-print inline-flex shrink-0 items-center gap-2 text-sm ${dark ? 'text-white' : ''}`}
    >
      <Globe2 size={16} aria-hidden="true" />
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
