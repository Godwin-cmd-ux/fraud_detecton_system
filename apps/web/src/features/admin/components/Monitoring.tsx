import { useLanguage, translate as tr } from '../../../i18n';
import { useSearchParams } from 'react-router';
import { TopHeader } from '../../../components/layout/TopHeader';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';

export function MonitoringHeader({ title }: { title: string }) {
  useLanguage();
  return <TopHeader title={tr(title)} />;
}

export function useMonitoringFilters() {
  const [params, setParams] = useSearchParams();
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  }
  return {
    params,
    update,
    clear: () => setParams({}),
    page: Math.max(1, Number(params.get('page')) || 1),
  };
}

export function MonitoringFilters({
  fields,
}: {
  fields: { key: string; label: string; options?: readonly string[]; type?: string }[];
}) {
  useLanguage();
  const { params, update, clear } = useMonitoringFilters();
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      {fields.map(({ key, label, options, type }) => (
        <label key={key} className="text-sm font-semibold">
          {tr(label)}
          {options ? (
            <Select
              aria-label={tr(label)}
              value={params.get(key) ?? (key === 'reviewed' ? 'unreviewed' : '')}
              onChange={(e) => update(key, e.target.value)}
            >
              {key !== 'reviewed' && <option value="">{tr('All')}</option>}
              {options.map((option) => (
                <option key={option} value={option}>
                  {tr(option)}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              aria-label={tr(label)}
              type={type ?? 'text'}
              value={params.get(key) ?? ''}
              onChange={(e) => update(key, e.target.value)}
            />
          )}
        </label>
      ))}
      <Button variant="secondary" onClick={clear}>
        {tr('Clear Filters')}
      </Button>
    </div>
  );
}
