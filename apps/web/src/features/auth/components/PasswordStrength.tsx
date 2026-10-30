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
  const label = score <= 2 ? 'Weak' : score <= 4 ? 'Medium' : 'Strong';
  if (!password) return null;
  return (
    <div className="space-y-1 text-sm">
      <meter
        aria-label={tr('Password strength')}
        min={0}
        max={6}
        value={score}
        className="w-full"
      />
      <p className={score <= 2 ? 'text-s-red' : score <= 4 ? 'text-s-amber' : 'text-s-teal'}>
        {tr('Password strength: ')}
        {tr(label)}
      </p>
    </div>
  );
}

export default PasswordStrength;
