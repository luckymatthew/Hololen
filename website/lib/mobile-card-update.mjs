import { createHash } from 'node:crypto';
const own = (value, key) => Object.hasOwn(value, key);
const fail = message => { throw new Error(`Mobile card update channel: ${message}`); };
// Matches the released Android reader's paired fields and first-entry same-date ordering.
// sourceCatalogSha256 is provenance; catalogSha256 selects the actual downloadable bytes.
export function validateMobileCardUpdate({ log, catalogBytes }) {
  if (!log || log.schemaVersion !== 1 || !Array.isArray(log.entries) || log.entries.length > 10000) fail('invalid update log');
  let latest = null;
  for (const row of log.entries) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) fail('invalid update row');
    if (!own(row, 'catalogVersion') && !own(row, 'catalogSha256')) continue;
    if (typeof row.catalogVersion !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(row.catalogVersion)) fail('missing or invalid catalogVersion');
    if (typeof row.catalogSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(row.catalogSha256)) fail('missing or invalid catalogSha256');
    if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(`${row.date}T00:00:00Z`)) || new Date(`${row.date}T00:00:00Z`).toISOString().slice(0, 10) !== row.date) fail('invalid catalog date');
    if (own(row, 'counts')) {
      if (!row.counts || typeof row.counts !== 'object' || Array.isArray(row.counts)) fail('invalid update counts');
      for (const field of ['newCards', 'newPrintings']) if (own(row.counts, field) && (!Number.isSafeInteger(row.counts[field]) || row.counts[field] < 0 || row.counts[field] > 2147483647)) fail('invalid update count');
    }
    if (!latest || row.date > latest.date) latest = row;
  }
  if (!latest) fail('no catalog offer');
  if (!(typeof catalogBytes === 'string' || catalogBytes instanceof Uint8Array)) fail('exact catalog bytes required');
  const bytes = Buffer.from(catalogBytes), digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== latest.catalogSha256) fail('latest catalogSha256 does not match downloadable cards.json');
  const catalog = JSON.parse(bytes.toString('utf8'));
  if (catalog.meta?.catalogVersion !== latest.catalogVersion) fail('offered catalogVersion does not match cards.json');
  return { version: latest.catalogVersion, digest, date: latest.date };
}
