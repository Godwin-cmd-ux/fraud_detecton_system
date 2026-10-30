/** Muted tints that sit with the brand palette; never the status colours, so an avatar can't read as a state. */
const tints = [
  'bg-[#e3efe7] text-[#1f5f4b]',
  'bg-[#e6ecf3] text-[#3a5675]',
  'bg-[#f1eadf] text-[#7a5a2c]',
  'bg-[#ece7f1] text-[#5b4a75]',
  'bg-[#e5eeee] text-[#2f6264]',
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const hash = [...name].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${tints[hash % tints.length]}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}
