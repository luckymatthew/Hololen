// Platform-neutral JSON contract. Millisecond timestamps work on web/Android/iOS.
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).filter(k => !k.startsWith('_')).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function content(row) {
  if (!row) return '';
  const { updatedAt, revision, ...rest } = row;
  return stable(rest);
}
export function clean(row) { return JSON.parse(JSON.stringify(row, (key, value) => key.startsWith('_') ? undefined : value)); }
export function mergeDecision(local, remote) {
  if (!remote) return { winner: local, upload: true, conflict: null };
  if (!local || !local._dirty) return { winner: remote, upload: false, conflict: null };
  if (content(local) === content(remote)) return { winner: remote, upload: false, conflict: null };
  if (local._base === content(remote)) return { winner: local, upload: true, conflict: null };
  // A concurrent edit is never discarded, even with skewed device clocks.
  const localWins = local.updatedAt > remote.updatedAt;
  return { winner: localWins ? local : remote, upload: localWins, conflict: localWins ? remote : local };
}
