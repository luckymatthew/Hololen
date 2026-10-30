// Synthetic translation release fixtures only; never published as actual translations.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const digest = value => createHash('sha256').update(value).digest('hex');
const current = JSON.parse(readFileSync(new URL('../public/cards.json', import.meta.url), 'utf8'));
const oldReport = JSON.parse(readFileSync(new URL('../docs/card-refresh-2026-10-29/report.json', import.meta.url), 'utf8'));
const currentHistory = JSON.parse(readFileSync(new URL('../public/website-updates.json', import.meta.url), 'utf8'));
const originalId = `official-cards-${oldReport.capturedAt.slice(0, 10)}-${oldReport.resultCatalogSha256.slice(0, 12)}`;
const originalEntry = currentHistory.entries.find(entry => entry.id === originalId);
if (!originalEntry) throw new Error('The immutable original illustrated card update is missing.');
export const legacyHistory = { schemaVersion: 1, entries: [structuredClone(originalEntry)] };

function fields(card) {
  const result = [];
  for (const key of ['name', 'abilityText', 'extra']) if (card[key]) result.push([key, card[key]]);
  for (const key of ['stageSkill', 'oshiSkill', 'spOshiSkill', 'keyword']) for (const part of ['name', 'effect', 'timing']) if (card[key]?.[part]) result.push([`${key}.${part}`, card[key][part]]);
  for (const [i, art] of (card.arts || []).entries()) for (const part of ['name', 'effect']) if (art[part]) result.push([`arts.${i}.${part}`, art[part]]);
  return result;
}

export function translationInput({ previous = legacyHistory, revision = 'test-only-translations-1', date = '2026-10-30T00:00:00Z' } = {}) {
  const catalog = { meta: current.meta, cards: structuredClone(current.cards.filter(card => card.officialImportSchema === 2).slice(0, 2)) };
  const translations = { meta: { version: revision, displayOnly: true, changesGameplay: false }, cards: Object.fromEntries(catalog.cards.map((card, index) => [card.number, {
    sourceLanguage: 'ja', displayLanguage: 'zh-Hant', translationStatus: 'ai-translated-from-official-japanese', humanReviewStatus: 'not-reviewed', engineSupportStatus: 'not-changed-by-translation',
    fields: fields(card).map(([path, original]) => ({ path, original, translation: path === 'name' ? `測試卡名 ${index + 1}` : `測試譯文 ${path}` })),
  }])) };
  const catalogBytes = Buffer.from(JSON.stringify(catalog)), translationBytes = Buffer.from(JSON.stringify(translations));
  return { report: { schemaVersion: 1, kind: 'translation', capturedAt: date, translationRevision: revision, sourceCatalogSha256: digest(catalogBytes), translationSha256: digest(translationBytes), translatedCardNumbers: catalog.cards.map(card => card.number), translatedFieldCount: Object.values(translations.cards).reduce((sum, card) => sum + card.fields.length, 0) }, catalogBytes, translationBytes, previous: structuredClone(previous) };
}

export function changeTranslation(input, change) {
  const data = JSON.parse(input.translationBytes); change(data); input.translationBytes = Buffer.from(JSON.stringify(data)); input.report.translationSha256 = digest(input.translationBytes);
}

export function changeCatalog(input, change) {
  const data = JSON.parse(input.catalogBytes); change(data); input.catalogBytes = Buffer.from(JSON.stringify(data)); input.report.sourceCatalogSha256 = digest(input.catalogBytes);
}
