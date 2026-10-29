import { useSearchParams } from 'react-router';
import { useMe } from '../../../api/auth';
import { TopHeader } from '../../../components/layout/TopHeader';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';

export function MonitoringHeader({ title }: { title: string }) {
  const me = useMe();
  return <TopHeader title={title} name={me.data?.name ?? 'Administrator'} />;
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
  const { params, update, clear } = useMonitoringFilters();
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      {fields.map(({ key, label, options, type }) => (
        <label key={key} className="text-sm font-semibold">
          {label}
          {options ? (
            <Select
              aria-label={label}
              value={params.get(key) ?? (key === 'reviewed' ? 'unreviewed' : '')}
              onChange={(e) => update(key, e.target.value)}
            >
              {key !== 'reviewed' && <option value="">All</option>}
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              aria-label={label}
              type={type ?? 'text'}
              value={params.get(key) ?? ''}
              onChange={(e) => update(key, e.target.value)}
            />
          )}
        </label>
      ))}
      <Button variant="secondary" onClick={clear}>
        Clear Filters
      </Button>
    </div>
  );
}
