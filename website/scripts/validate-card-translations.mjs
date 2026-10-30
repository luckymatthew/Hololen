// Publication gate only. Canonical Japanese catalog/rules are never rewritten.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const DEFAULT_TRANSLATION_FILES = ['hbp09-zh-Hant.json', 'official-cards-zh-Hant.json'];
const LEGACY_VERSION = '2026-09-19-hBP09-zhHant-2';
const LEGACY_NUMBERS = Array.from({ length: 111 }, (_, i) => `hBP09-${String(i + 1).padStart(3, '0')}`);
const KANA = /[\u3040-\u30ff]/u;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const normalize = value => Array.isArray(value) ? value.map(normalize) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])])) : value;
const canonical = value => JSON.stringify(normalize(value));
const fail = message => { throw new Error(`Translation publication gate: ${message}`); };
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const numericTokens = value => (value.match(/\d+/g) || []).sort();

export function displayTextFields(card) {
  const fields = ['name', 'abilityText', 'extra'].map(key => ({ path: key, original: card?.[key] }));
  for (const key of ['stageSkill', 'oshiSkill', 'spOshiSkill', 'keyword']) {
    for (const part of ['name', 'effect', 'timing']) fields.push({ path: `${key}.${part}`, original: card?.[key]?.[part] });
  }
  for (const [i, art] of (card?.arts || []).entries()) {
    for (const key of ['name', 'effect']) fields.push({ path: `arts.${i}.${key}`, original: art?.[key] });
  }
  return fields.filter(field => nonempty(field.original));
}

export function sourceTextProjection(card) {
  return { number: card.number, jpName: card.jpName || '', fields: displayTextFields(card), tags: [...(card.tags || [])] };
}
export function sourceTextSha256(card) { return sha256(canonical(sourceTextProjection(card))); }

function validSourceUrl(value, card) {
  try {
    const url = new URL(value);
    if (url.origin !== 'https://hololive-official-cardgame.com' || !url.pathname.startsWith('/cardlist/') || url.username || url.password) return false;
    if (card.sourceUrl && new URL(card.sourceUrl).searchParams.get('id') !== url.searchParams.get('id')) return false;
    return Boolean(url.searchParams.get('id'));
  } catch { return false; }
}
function cheerWithoutEffects(card) {
  return card.group === 'cheer' && card.nameTranslationStatus === 'reviewed-mapping'
    && nonempty(card.name) && !KANA.test(card.name)
    && displayTextFields(card).every(field => field.path === 'name')
    && !(card.tags || []).some(tag => KANA.test(tag));
}
function isLegacy(bundle) {
  return bundle.meta?.version === LEGACY_VERSION && canonical(Object.keys(bundle.cards || {}).sort()) === canonical(LEGACY_NUMBERS);
}

export function validateCardTranslations({ catalog, bundles, requiredNumbers = [] }) {
  if (!catalog || !Array.isArray(catalog.cards) || !Array.isArray(bundles) || !bundles.length || !Array.isArray(requiredNumbers)) fail('catalog and translation bundles are required.');
  const byNumber = new Map(catalog.cards.map(card => [card.number, card]));
  if (byNumber.size !== catalog.cards.length) fail('duplicate canonical card numbers.');
  const explicitlyRequired = new Set(requiredNumbers);
  for (const number of explicitlyRequired) if (!byNumber.has(number)) fail(`required card is absent: ${number}`);
  const entries = new Map(), tags = new Map();
  const counts = { translatedCards: 0, translatedFields: 0, translatedEffectFields: 0, legacyCards: 0, sourceHashedCards: 0, exemptCheerCards: 0, requiredCards: 0, translatedTags: 0 };
  for (const bundle of bundles) {
    if (!bundle?.meta || !nonempty(bundle.meta.version) || bundle.meta.displayOnly !== true || bundle.meta.changesGameplay !== false || !bundle.cards || typeof bundle.cards !== 'object' || Array.isArray(bundle.cards)) fail('bundle must be versioned, display-only and explicitly not gameplay.');
    const legacy = isLegacy(bundle), numbers = Object.keys(bundle.cards);
    const status = legacy ? 'AI translation from supplied official-Japanese snapshot; not official or human-approved' : 'ai-translated-from-official-japanese';
    if (bundle.meta.translationStatus !== status || (bundle.meta.humanReviewStatus != null && bundle.meta.humanReviewStatus !== 'not-reviewed') || (bundle.meta.engineSupportStatus != null && bundle.meta.engineSupportStatus !== 'not-changed-by-translation')) fail(`bundle ${bundle.meta.version}: metadata must not claim official/human/gameplay approval.`);
    if (bundle.meta.cardCount != null && bundle.meta.cardCount !== numbers.length) fail(`bundle ${bundle.meta.version}: cardCount mismatch.`);
    let effects = 0, fields = 0;
    for (const [tag, translation] of Object.entries(bundle.tagDisplay || {})) {
      if (!nonempty(tag) || !nonempty(translation) || KANA.test(translation)) fail(`invalid display tag translation: ${tag}`);
      if (tags.has(tag) && tags.get(tag) !== translation) fail(`conflicting display tag translation: ${tag}`);
      tags.set(tag, translation);
    }
    for (const [number, entry] of Object.entries(bundle.cards)) {
      const card = byNumber.get(number);
      if (!card) fail(`translation references unknown card: ${number}`);
      if (entries.has(number)) fail(`duplicate translation card: ${number}`);
      if (entry?.sourceLanguage !== 'ja' || entry.displayLanguage !== 'zh-Hant' || entry.translationStatus !== 'ai-translated-from-official-japanese' || entry.humanReviewStatus !== 'not-reviewed' || entry.engineSupportStatus !== 'not-changed-by-translation') fail(`${number}: translation metadata must not claim official/human/gameplay approval.`);
      if (!validSourceUrl(entry.sourceUrl, card)) fail(`${number}: invalid/mismatched official source URL.`);
      if (!Array.isArray(entry.fields)) fail(`${number}: fields must be an array.`);
      const expected = displayTextFields(card), expectedMap = new Map(expected.map(field => [field.path, field.original]));
      const strict = !legacy || card.officialImportSchema >= 2;
      if (strict && entry.sourceSha256 !== sourceTextSha256(card)) fail(`${number}: sourceSha256 is missing or stale.`);
      if (!strict && entry.sourceSha256 != null && entry.sourceSha256 !== sourceTextSha256(card)) fail(`${number}: supplied sourceSha256 is stale.`);
      const seen = new Set(), byOriginal = new Map();
      for (const field of entry.fields) {
        if (!field || !nonempty(field.path) || seen.has(field.path)) fail(`${number}: duplicate/invalid field path.`);
        seen.add(field.path);
        if (!expectedMap.has(field.path) || field.original !== expectedMap.get(field.path)) fail(`${number}/${field.path}: exact original Japanese source guard is missing or stale.`);
        if (!nonempty(field.translation) || KANA.test(field.translation)) fail(`${number}/${field.path}: missing translation or untranslated kana.`);
        if (strict && canonical(numericTokens(field.original)) !== canonical(numericTokens(field.translation))) fail(`${number}/${field.path}: numeric counts/thresholds changed.`);
        if (byOriginal.has(field.original) && byOriginal.get(field.original) !== field.translation) fail(`${number}: identical source text has ambiguous translations.`);
        byOriginal.set(field.original, field.translation);
        if (/\.effect$/.test(field.path) || ['abilityText', 'extra'].includes(field.path)) effects++;
      }
      for (const field of expected) if (!seen.has(field.path)) fail(`${number}/${field.path}: required nonempty display field has no translation.`);
      fields += seen.size;
      entries.set(number, { entry, legacy, strict });
      counts.translatedCards++; counts.translatedFields += seen.size;
      if (legacy) counts.legacyCards++; if (entry.sourceSha256) counts.sourceHashedCards++;
    }
    if (bundle.meta.effectFieldCount != null && bundle.meta.effectFieldCount !== effects) fail(`bundle ${bundle.meta.version}: effectFieldCount mismatch.`);
    if (bundle.meta.fieldCount != null && bundle.meta.fieldCount !== fields) fail(`bundle ${bundle.meta.version}: fieldCount mismatch.`);
    counts.translatedEffectFields += effects;
  }
  for (const card of catalog.cards) {
    const required = explicitlyRequired.has(card.number) || card.officialImportSchema >= 2 || card.effectLanguage === 'ja' || card.translationStatus === 'official-japanese-fallback' || entries.has(card.number);
    if (!required) continue;
    counts.requiredCards++;
    if (cheerWithoutEffects(card)) { counts.exemptCheerCards++; continue; }
    const translated = entries.get(card.number);
    if (!translated) fail(`${card.number}: newly imported/Japanese card cannot ship without complete translations.`);
    // Preserve the old hBP09 canonical-tag policy. Future/new cards need display tags too.
    if (card.officialImportSchema >= 2 || explicitlyRequired.has(card.number) || !translated.legacy) {
      for (const tag of card.tags || []) if (KANA.test(tag) && !tags.has(tag)) fail(`${card.number}: missing display translation for tag ${tag}`);
    }
  }
  counts.translatedTags = tags.size;
  return { schemaVersion: 1, valid: true, ...counts, displayOnly: true, changesGameplay: false };
}

export function validateTranslationFiles({ directory = 'public', bundleFiles = DEFAULT_TRANSLATION_FILES, refreshReportPath = null } = {}) {
  const catalog = JSON.parse(fs.readFileSync(path.join(directory, 'cards.json'), 'utf8'));
  const bundles = bundleFiles.map(file => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')));
  const report = refreshReportPath ? JSON.parse(fs.readFileSync(refreshReportPath, 'utf8')) : null;
  if (report && (!Array.isArray(report.newCardNumbers) || report.schemaVersion !== 2)) fail('refresh report must be a verified schema-2 report.');
  return validateCardTranslations({ catalog, bundles, requiredNumbers: report?.newCardNumbers || [] });
}

export function assertTranslationArtifactMatchesSource({ sourceDirectory = 'public', artifactDirectory = 'dist-firebase', bundleFiles = DEFAULT_TRANSLATION_FILES } = {}) {
  const source = validateTranslationFiles({ directory: sourceDirectory, bundleFiles });
  validateTranslationFiles({ directory: artifactDirectory, bundleFiles });
  for (const file of ['cards.json', ...bundleFiles]) {
    if (!fs.readFileSync(path.join(sourceDirectory, file)).equals(fs.readFileSync(path.join(artifactDirectory, file)))) fail(`built ${file} does not match the tested source bytes.`);
  }
  return source;
}

export function main(args = process.argv.slice(2)) {
  const options = { directory: 'public', bundleFiles: [], refreshReportPath: null };
  for (const arg of args) {
    if (arg.startsWith('--directory=')) options.directory = arg.slice('--directory='.length);
    else if (arg.startsWith('--bundle=')) options.bundleFiles.push(arg.slice('--bundle='.length));
    else if (arg.startsWith('--refresh-report=')) options.refreshReportPath = arg.slice('--refresh-report='.length);
    else fail('Usage: node scripts/validate-card-translations.mjs [--directory=public] [--bundle=file.json] [--refresh-report=report.json]');
  }
  if (!options.bundleFiles.length) options.bundleFiles = DEFAULT_TRANSLATION_FILES;
  const result = validateTranslationFiles(options);
  console.log(JSON.stringify(result));
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
