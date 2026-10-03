import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const productUrl = /^https:\/\/yuyu-tei\.jp\/sell\/hocg\/card\/[a-z0-9-]+\/[0-9]{5}$/;

/** Validate public primary-browser records without fetching or changing either catalog. */
export function verifiedYuyuteiProducts(records, catalog) {
  if (!Array.isArray(records)) throw new Error('Expected an array of primary-browser records');
  const cards = new Map(catalog.cards.map(card => [card.number, card]));
  const keys = new Set(), urls = new Set();
  return records.map((record, index) => {
    const fail = message => { throw new Error(`Record ${index + 1}: ${message}`); };
    if (!record || typeof record !== 'object') fail('record must be an object');
    const card = cards.get(record.number);
    if (!card) fail('number is absent from the preserved catalog');
    if (!productUrl.test(record.url || '')) fail('expected a canonical HTTPS Yuyutei product URL, without damage/query/fragment');
    if (typeof record.rarity !== 'string' || !record.rarity) fail('observed rarity is required');
    if (typeof record.title !== 'string' || !record.title.trim().replace(/\s+/g, ' ').startsWith(`${record.rarity} `) || !record.title.includes(card.jpName) || record.title.includes('【傷】')) fail('primary title must start with the observed rarity, contain the exact catalog Japanese name and describe a standard product');
    if (record.method !== 'primary-browser' || record.artworkConfirmed !== true) fail('primary-browser artwork comparison is required; snippets are insufficient');
    const errata = record.title.match(/エラッタ(前|後)/)?.[1];
    const errataVersion = errata === '前' ? 'before' : errata === '後' ? 'after' : null;
    if (errataVersion && (record.errataConfirmed !== true || record.errataVersion !== errataVersion)) fail('errata product requires a separately confirmed printed-text/version match');
    if (typeof record.observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(record.observedAt) || !Number.isFinite(Date.parse(record.observedAt))) fail('observedAt must be an ISO timestamp with timezone');
    if (typeof record.reference !== 'string' || !record.reference.trim()) fail('public browser evidence reference is required');
    let artworkComparison;
    if (record.artworkComparison !== undefined) {
      const comparison = record.artworkComparison;
      if (!comparison || typeof comparison !== 'object' ||
          !['basis', 'details'].every(key => typeof comparison[key] === 'string' && comparison[key].trim()) ||
          !['retailerSha256', 'officialSha256'].every(key => typeof comparison[key] === 'string' && /^[a-f0-9]{64}$/.test(comparison[key]))) fail('artworkComparison requires a recorded visual basis/details and both SHA-256 hashes');
      artworkComparison = {
        basis: comparison.basis, details: comparison.details,
        retailerSha256: comparison.retailerSha256, officialSha256: comparison.officialSha256,
        ...(typeof comparison.scanDifferences === 'string' ? { scanDifferences: comparison.scanDifferences } : {}),
      };
    }
    let image;
    try { image = new URL(record.retailerImage); } catch { fail('observed retailer artwork URL is required'); }
    if (image.protocol !== 'https:' || image.username || image.password) fail('retailerImage must be HTTPS without credentials');
    if (!record.officialImage && !record.printingId) fail('exact matched officialImage or stable printingId is required');
    const matches = card.variants.filter(variant => variant.rarity === record.rarity &&
      (!record.officialImage || variant.image === record.officialImage) &&
      (!record.printingId || variant.id === record.printingId));
    if (matches.length !== 1) fail('number/rarity/artwork/ID must identify exactly one existing printing');
    const printing = matches[0], key = `${card.number}|${printing.id}`;
    const retailerGroup = new URL(record.url).pathname.split('/').at(-2);
    if (/^hbp\d+$/.test(retailerGroup) && !printing.image.toLowerCase().includes(`/${retailerGroup}/`)) fail('retailer booster set disagrees with the matched catalog artwork edition');
    if (keys.has(key) || urls.has(record.url)) fail('duplicate printing or reused retailer URL; review separately');
    keys.add(key); urls.add(record.url);
    return {
      number: card.number, printingId: printing.id, rarity: printing.rarity, url: record.url,
      retailerName: card.jpName, retailerSet: retailerGroup, officialImage: printing.image, printingVerified: true,
      evidence: {
        method: 'primary-browser', sourceUrl: record.url, number: record.number, rarity: record.rarity,
        title: record.title, retailerImage: record.retailerImage, officialImage: printing.image,
        artworkConfirmed: true, observedAt: record.observedAt, reference: record.reference,
        retailerSet: record.retailerSet || retailerGroup, editionLabel: record.editionLabel || '',
        ...(errataVersion ? { errataConfirmed: true, errataVersion } : {}),
        ...(artworkComparison ? { artworkComparison } : {}),
      },
    };
  }).sort((a, b) => {
    const left = `${a.number}|${a.printingId}`, right = `${b.number}|${b.printingId}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , recordsPath, outputPath] = process.argv;
  if (!recordsPath) throw new Error('Usage: node scripts/validate-yuyutei-evidence.mjs records.json [preview-output.json]');
  const payload = JSON.parse(readFileSync(recordsPath, 'utf8'));
  const catalog = JSON.parse(readFileSync(new URL('../public/cards.json', import.meta.url), 'utf8'));
  const products = verifiedYuyuteiProducts(Array.isArray(payload) ? payload : payload.records, catalog);
  const output = JSON.stringify({ products }, null, 2) + '\n';
  if (outputPath) writeFileSync(outputPath, output); else process.stdout.write(output);
}
