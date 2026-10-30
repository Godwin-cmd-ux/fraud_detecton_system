/** Drops leading pictographs and symbols (e.g. "✅ Saved") so messages render as plain text beside our own icons. */
export function plainText<T>(value: T): T {
  return (
    typeof value === 'string' ? value.replace(/^[^\p{L}\p{N}"'(]+/u, '') : value
  ) as T;
}
