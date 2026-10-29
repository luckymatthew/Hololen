// Build an append-only public changelog from a verified card-refresh report.
// No account data, credentials, local paths, or invented historical releases.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const IMAGE_PREFIX = 'https://hololive-official-cardgame.com/wp-content/images/cardlist/';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };

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
  const positional = args.filter(arg => !arg.startsWith('--note='));
  const notes = args.filter(arg => arg.startsWith('--note=')).map(arg => arg.slice('--note='.length));
  const [reportPath, catalogPath = 'public/cards.json', outputPath = 'public/website-updates.json'] = positional;
  if (!reportPath || positional.length > 3) fail('Usage: node scripts/build-website-update-log.mjs <report.json> [cards.json] [website-updates.json] [--note=Website change]');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const bytes = fs.readFileSync(catalogPath);
  if (sha256(bytes) !== report.resultCatalogSha256) fail('The refresh report does not match the exact catalog bytes.');
  const previous = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, 'utf8')) : { schemaVersion: 1, entries: [] };
  const result = appendWebsiteCardUpdate({ report, catalog: JSON.parse(bytes), previous, notes });
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ entries: result.entries.length, addedEntries: result.entries.length - previous.entries.length, outputPath }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
