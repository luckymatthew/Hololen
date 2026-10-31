// Build an append-only public changelog from a verified card-refresh report.
// No account data, credentials, local paths, or invented historical releases.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const IMAGE_PREFIX = 'https://hololive-official-cardgame.com/wp-content/images/cardlist/';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };

function verifiedImage(image, number) {
  try {
    const url = new URL(image);
    if (url.origin === 'https://hololive-official-cardgame.com' && url.pathname.startsWith('/wp-content/images/cardlist/') && !url.username && !url.password) return;
  } catch {}
  fail(`Untrusted public changelog image for ${number}`);
}

function displayFields(card) {
  const result = [];
  for (const key of ['name', 'abilityText', 'extra']) if (typeof card[key] === 'string' && card[key]) result.push([key, card[key]]);
  for (const key of ['stageSkill', 'oshiSkill', 'spOshiSkill', 'keyword']) {
    for (const part of ['name', 'effect', 'timing']) if (typeof card[key]?.[part] === 'string' && card[key][part]) result.push([`${key}.${part}`, card[key][part]]);
  }
  for (const [index, art] of (card.arts || []).entries()) {
    for (const part of ['name', 'effect']) if (typeof art[part] === 'string' && art[part]) result.push([`arts.${index}.${part}`, art[part]]);
  }
  return result;
}

// Translation-only releases are distinct from new cards/printings. Exact file
// digests and source strings keep a stale or partial translation out of history.
export function appendWebsiteTranslationUpdate({ report, catalogBytes, translationBytes, previous = { schemaVersion: 1, entries: [] }, notes = [] }) {
  if (!report || report.schemaVersion !== 1 || report.kind !== 'translation' || typeof report.capturedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(report.capturedAt) || !Number.isFinite(Date.parse(report.capturedAt)) || typeof report.translationRevision !== 'string' || !/^[A-Za-z0-9._-]{1,100}$/.test(report.translationRevision) || typeof report.sourceCatalogSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(report.sourceCatalogSha256) || typeof report.translationSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(report.translationSha256) || !Array.isArray(report.translatedCardNumbers) || !Number.isInteger(report.translatedFieldCount) || report.translatedFieldCount < 0) fail('A complete verified translation-only report is required.');
  if (report.newCardNumbers?.length || report.addedVariants?.length || report.newCards || report.newPrintings) fail('A translation-only update cannot claim new cards or printings.');
  if (previous.schemaVersion !== 1 || !Array.isArray(previous.entries) || new Set(previous.entries.map(entry => entry.id)).size !== previous.entries.length) fail('Unexpected or duplicate existing website update entries.');
  if (!Array.isArray(notes) || notes.some(note => typeof note !== 'string' || !note.trim())) fail('Invalid website translation notes.');
  if (!((typeof catalogBytes === 'string' || catalogBytes instanceof Uint8Array) && (typeof translationBytes === 'string' || translationBytes instanceof Uint8Array))) fail('Exact catalog and translation bytes are required.');
  if (sha256(catalogBytes) !== report.sourceCatalogSha256) fail('The translation report does not match the exact source catalog bytes.');
  if (sha256(translationBytes) !== report.translationSha256) fail('The translation report does not match the exact translation bytes.');
  const catalog = JSON.parse(Buffer.from(catalogBytes).toString('utf8'));
  const translations = JSON.parse(Buffer.from(translationBytes).toString('utf8'));
  if (!Array.isArray(catalog.cards) || !translations.cards || translations.meta?.version !== report.translationRevision || translations.meta.displayOnly !== true || translations.meta.changesGameplay !== false) fail('Translation revision, display-only scope or catalog structure does not match the report.');
  const numbers = new Set(report.translatedCardNumbers);
  if (numbers.size !== report.translatedCardNumbers.length || [...numbers].some(number => typeof number !== 'string' || !number)) fail('Duplicate or invalid translated card numbers.');
  const result = structuredClone(previous);
  if (!numbers.size) {
    if (report.translatedFieldCount !== 0) fail('Empty translation update cannot claim translated fields.');
    return result;
  }
  const byNumber = new Map(catalog.cards.map(card => [card.number, card]));
  if (byNumber.size !== catalog.cards.length) fail('Duplicate catalog card numbers.');
  let fieldCount = 0;
  const cards = [...numbers].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).map(number => {
    const card = byNumber.get(number), entry = translations.cards[number];
    if (!card || typeof card.name !== 'string' || !card.name.trim() || typeof card.jpName !== 'string' || !entry || entry.sourceLanguage !== 'ja' || entry.displayLanguage !== 'zh-Hant' || entry.translationStatus !== 'ai-translated-from-official-japanese' || entry.humanReviewStatus !== 'not-reviewed' || entry.engineSupportStatus !== 'not-changed-by-translation' || !Array.isArray(entry.fields)) fail(`Missing verified display translation for ${number}`);
    const expected = new Map(displayFields(card)), fields = new Map();
    for (const field of entry.fields) {
      if (!field || !expected.has(field.path) || fields.has(field.path) || field.original !== expected.get(field.path) || typeof field.translation !== 'string' || !field.translation.trim()) fail(`Translation source/field does not match the current catalog: ${number}/${field?.path}`);
      fields.set(field.path, field.translation);
    }
    if (fields.size !== expected.size) fail(`Incomplete display translation for ${number}`);
    fieldCount += fields.size;
    const variant = card.variants?.[0];
    if (!variant?.id || typeof variant.image !== 'string' || typeof variant.rarity !== 'string' || (variant.sets != null && (!Array.isArray(variant.sets) || variant.sets.some(product => typeof product !== 'string')))) fail(`Translated card has no verified changelog printing: ${number}`);
    verifiedImage(variant.image, number);
    return { kind: 'translation', number, name: fields.get('name'), jpName: card.jpName, rarity: variant.rarity, image: variant.image, printingId: variant.id, products: [...(variant.sets || [])] };
  });
  if (fieldCount !== report.translatedFieldCount) fail('Translated field count does not match the verified translation data.');
  if (new Set(cards.map(card => card.printingId)).size !== cards.length) fail('Duplicate translation changelog printing identity.');
  const id = `translations-${report.translationRevision}-${report.translationSha256.slice(0, 12)}`;
  if (result.entries.some(entry => entry.id === id)) return result;
  if (result.entries.some(entry => entry.kind === 'translation' && entry.translationRevision === report.translationRevision && entry.translationSha256 !== report.translationSha256)) fail('Translation revision must change when translation bytes change.');
  result.entries.push({
    id, kind: 'translation', date: report.capturedAt.slice(0, 10), title: '繁中翻譯更新',
    summary: [
      `本次翻譯資料涵蓋 ${cards.length} 個既有卡號、${fieldCount} 個文字欄位；沒有新增卡號或卡圖。`,
      '下表每個卡號列出一款既有卡圖作識別，並非新增印刷版本。',
      '譯文依官方日文整理，屬 AI 翻譯，並非官方譯文，亦未經人工覆核或核准；僅供顯示，保留官方日文與原有資料識別。',
      '翻譯更新不代表效果已實作；未支援效果仍須依官方規則另行人工處理。',
      ...notes.map(note => note.trim()),
    ],
    counts: { newCards: 0, newPrintings: 0, newPrintingsForExistingCards: 0, translatedCards: cards.length, translatedFields: fieldCount },
    sourceUrl: 'https://hololive-official-cardgame.com/cardlist/',
    catalogVersion: catalog.meta?.catalogVersion || '', catalogSha256: report.sourceCatalogSha256, sourceCatalogSha256: report.sourceCatalogSha256,
    translationRevision: report.translationRevision, translationSha256: report.translationSha256,
    cards,
  });
  result.entries.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return result;
}

export function appendWebsiteCardUpdate({ report, catalog, previous = { schemaVersion: 1, entries: [] }, notes = [] }) {
  if (report.schemaVersion !== 2 || !Array.isArray(report.newCardNumbers) || !Array.isArray(report.addedVariants) || !/^\d{4}-\d{2}-\d{2}T/.test(report.capturedAt || '') || !/^[a-f0-9]{64}$/.test(report.resultCatalogSha256 || '')) fail('A complete verified schema-2 refresh report is required.');
  if (previous.schemaVersion !== 1 || !Array.isArray(previous.entries) || new Set(previous.entries.map(entry => entry.id)).size !== previous.entries.length) fail('Unexpected or duplicate existing website update entries.');
  if (!Array.isArray(catalog.cards) || !Array.isArray(notes) || notes.some(note => typeof note !== 'string' || !note.trim())) fail('Invalid card catalog or website notes.');
  const result = structuredClone(previous);
  if (!report.newCardNumbers.length && !report.addedVariants.length) return result;
  const date = report.capturedAt.slice(0, 10);
  const id = `official-cards-${date}-${report.resultCatalogSha256.slice(0, 12)}`;
  // Repeated validation/publication must never duplicate or overwrite history.
  if (result.entries.some(entry => entry.id === id)) return result;
  const byNumber = new Map(catalog.cards.map(card => [card.number, card]));
  if (byNumber.size !== catalog.cards.length) fail('Duplicate catalog card numbers.');
  const newNumbers = new Set(report.newCardNumbers);
  if (newNumbers.size !== report.newCardNumbers.length) fail('Duplicate added card numbers.');
  const printingIds = new Set();
  const cards = report.addedVariants.map(item => {
    const card = byNumber.get(item.number);
    const variant = card?.variants?.find(variant => variant.id === item.id);
    if (!card || !variant || variant.image !== item.image || variant.rarity !== item.rarity || printingIds.has(item.id)) fail(`Added printing identity does not match the verified catalog: ${item.number}/${item.id}`);
    if (!String(variant.image).startsWith(IMAGE_PREFIX) || new URL(variant.image).origin !== 'https://hololive-official-cardgame.com') fail(`Untrusted public changelog image for ${item.number}`);
    printingIds.add(item.id);
    return {
      kind: newNumbers.has(item.number) ? 'new-card' : 'new-printing',
      number: card.number, name: card.name, jpName: card.jpName,
      rarity: variant.rarity, image: variant.image, printingId: variant.id,
      products: [...(variant.sets || [])],
      ...(variant.releaseDate ? { releaseDate: variant.releaseDate, preview: Boolean(variant.preview) } : {}),
      ...(variant.sourceUrl ? { sourceUrl: variant.sourceUrl } : {}),
    };
  }).sort((a, b) => Number(a.kind === 'new-printing') - Number(b.kind === 'new-printing') || a.number.localeCompare(b.number, 'en', { numeric: true }) || a.printingId.localeCompare(b.printingId, 'en', { numeric: true }));
  for (const number of newNumbers) if (!cards.some(card => card.number === number && card.kind === 'new-card')) fail(`New card has no verified changelog printing: ${number}`);
  const existingPrintings = cards.filter(card => card.kind === 'new-printing').length;
  const previewDates = [...new Set(cards.filter(card => card.preview).map(card => card.releaseDate))].sort();
  result.entries.push({
    id, date, title: '官方卡表更新',
    summary: [
      `新增 ${newNumbers.size} 個卡號及 ${cards.length} 個印刷版本／卡圖，其中 ${existingPrintings} 個為既有卡號的新版本。`,
      '保留既有卡號、卡圖識別及牌組相容性；新卡效果採官方日文原文，尚未支援自動對戰。',
      ...(previewDates.length ? [`部分新卡／卡圖為官方先行公開，發售日期：${previewDates.join('、')}（日本時間）。`] : []),
      ...notes.map(note => note.trim()),
    ],
    counts: { newCards: newNumbers.size, newPrintings: cards.length, newPrintingsForExistingCards: existingPrintings },
    sourceUrl: 'https://hololive-official-cardgame.com/cardlist/',
    catalogVersion: report.catalogVersion, catalogSha256: report.resultCatalogSha256,
    cards,
  });
  result.entries.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return result;
}

export function main(args = process.argv.slice(2)) {
  const positional = args.filter(arg => !arg.startsWith('--note=') && !arg.startsWith('--translations='));
  const notes = args.filter(arg => arg.startsWith('--note=')).map(arg => arg.slice('--note='.length));
  const translationOptions = args.filter(arg => arg.startsWith('--translations='));
  if (translationOptions.length > 1) fail('Supply exactly one translation file.');
  const translationPath = translationOptions[0]?.slice('--translations='.length);
  const [reportPath, catalogPath = 'public/cards.json', outputPath = 'public/website-updates.json'] = positional;
  if (!reportPath || positional.length > 3 || (translationOptions.length && !translationPath)) fail('Usage: node scripts/build-website-update-log.mjs <report.json> [cards.json] [website-updates.json] [--translations=translation.json] [--note=Website change]');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const bytes = fs.readFileSync(catalogPath);
  if (!translationPath && sha256(bytes) !== report.resultCatalogSha256) fail('The refresh report does not match the exact catalog bytes.');
  const previous = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, 'utf8')) : { schemaVersion: 1, entries: [] };
  const result = translationPath ? appendWebsiteTranslationUpdate({ report, catalogBytes: bytes, translationBytes: fs.readFileSync(translationPath), previous, notes }) : appendWebsiteCardUpdate({ report, catalog: JSON.parse(bytes), previous, notes });
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ entries: result.entries.length, addedEntries: result.entries.length - previous.entries.length, outputPath }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
