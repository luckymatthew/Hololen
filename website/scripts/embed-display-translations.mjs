// Data-only bridge for the separately versioned native reader. Never rewrites card records.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TRANSLATION_FILES, sourceTextSha256, validateCardTranslations } from './validate-card-translations.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const normalized = value => Array.isArray(value) ? value.map(normalized) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, normalized(value[key])])) : value;
const canonical = value => JSON.stringify(normalized(value));
export function withoutDisplayTranslations(catalog) { const result = structuredClone(catalog); delete result.displayTranslations; return result; }
export function buildDisplayTranslations(catalog, bundles) {
  validateCardTranslations({ catalog, bundles });
  const byNumber = new Map(catalog.cards.map(card => [card.number, card]));
  const cards = {}, tagDisplay = {};
  for (const bundle of bundles) {
    Object.assign(tagDisplay, bundle.tagDisplay || {});
    for (const [number, entry] of Object.entries(bundle.cards)) cards[number] = { sourceSha256: sourceTextSha256(byNumber.get(number)), fields: structuredClone(entry.fields) };
  }
  const content = { schemaVersion: 1, locale: 'zh-Hant', displayOnly: true, changesGameplay: false, sourceCatalogSha256: hash(JSON.stringify(withoutDisplayTranslations(catalog))), cards, tagDisplay };
  return { ...content, revision: hash(canonical(content)) };
}
export function embedDisplayTranslations(catalog, bundles) { return { ...withoutDisplayTranslations(catalog), displayTranslations: buildDisplayTranslations(catalog, bundles) }; }
export function validateEmbeddedDisplayTranslations({ directory = 'public', bundleFiles = DEFAULT_TRANSLATION_FILES } = {}) {
  const bytes = fs.readFileSync(path.join(directory, 'cards.json'));
  const catalog = JSON.parse(bytes), bundles = bundleFiles.map(file => JSON.parse(fs.readFileSync(path.join(directory, file))));
  const expected = buildDisplayTranslations(catalog, bundles);
  if (canonical(catalog.displayTranslations) !== canonical(expected)) throw new Error('Embedded display translations are missing/stale; run npm run data:translations before testing/publication.');
  return { valid: true, revision: expected.revision, cards: Object.keys(expected.cards).length, fields: Object.values(expected.cards).reduce((sum, entry) => sum + entry.fields.length, 0), sourceCatalogSha256: expected.sourceCatalogSha256, catalogSha256: hash(bytes) };
}
export function main(args = process.argv.slice(2)) {
  const check = args.includes('--check'), directoryArg = args.find(arg => arg.startsWith('--directory=')), directory = directoryArg ? directoryArg.slice('--directory='.length) : 'public';
  if (args.some(arg => arg !== '--check' && !arg.startsWith('--directory='))) throw new Error('Usage: node scripts/embed-display-translations.mjs [--check] [--directory=public]');
  if (!check) {
    const file = path.join(directory, 'cards.json'), before = fs.readFileSync(file), catalog = JSON.parse(before), bundles = DEFAULT_TRANSLATION_FILES.map(name => JSON.parse(fs.readFileSync(path.join(directory, name))));
    const after = Buffer.from(JSON.stringify(embedDisplayTranslations(catalog, bundles)));
    if (!after.equals(before)) fs.writeFileSync(file, after);
  }
  const result = validateEmbeddedDisplayTranslations({ directory }); console.log(JSON.stringify(result)); return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
