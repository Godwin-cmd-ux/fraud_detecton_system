import { useLanguage, translate as tr } from '../../../i18n';
export function passwordStrength(password: string): number {
  return [
    password.length >= 6,
    password.length >= 8,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[$@#&!]/.test(password),
  ].filter(Boolean).length;
}

export function PasswordStrength({ password }: { password: string }) {
  useLanguage();
  const score = passwordStrength(password);
  if (!password) return null;
  const level = score <= 2 ? 0 : score <= 4 ? 1 : 2;
  const label = ['Weak', 'Medium', 'Strong'][level]!;
  const color = ['var(--color-s-red)', 'var(--color-s-amber)', 'var(--color-s-teal)'][level];
  return (
    <div className="animate-slide-down space-y-1.5 text-[13px]">
      <meter
        aria-label={tr('Password strength')}
        min={0}
        max={6}
        value={score}
        className="sr-only"
      />
      <div className="grid grid-cols-6 gap-1" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="h-1 overflow-hidden rounded-full bg-s-line">
            <span
              className="block h-full rounded-full transition-[transform,background-color] duration-300 ease-out"
              style={{
                background: color,
                transform: `scaleX(${i < score ? 1 : 0})`,
                transformOrigin: 'left',
                transitionDelay: `${i * 30}ms`,
              }}
            />
          </span>
        ))}
      </div>
      <p className="flex justify-between gap-3">
        <span style={{ color }}>
          {tr('Password strength: ')}
          {tr(label)}
        </span>
        <span className="hidden text-s-dim sm:inline">
          {tr('Use 8+ characters with a number and a symbol')}
        </span>
      </p>
    </div>
  );
}

export default PasswordStrength;
