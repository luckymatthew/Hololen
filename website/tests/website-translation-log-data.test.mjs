import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { appendWebsiteTranslationUpdate } from '../scripts/build-website-update-log.mjs';
import { translationInput, changeTranslation, changeCatalog, legacyHistory } from './website-translation-log-fixtures.mjs';

const script = fileURLToPath(new URL('../scripts/build-website-update-log.mjs', import.meta.url));

test('translation-only log appends real existing illustrations with zero new cards/printings and exact field/revision digests', () => {
  const input = translationInput(), before = JSON.stringify(input.previous), result = appendWebsiteTranslationUpdate(input), entry = result.entries[0];
  assert.equal(result.schemaVersion, 1); assert.equal(result.entries.length, 2); assert.equal(entry.kind, 'translation');
  assert.deepEqual(entry.counts, { newCards: 0, newPrintings: 0, newPrintingsForExistingCards: 0, translatedCards: 2, translatedFields: input.report.translatedFieldCount });
  assert.equal(entry.translationRevision, input.report.translationRevision); assert.equal(entry.translationSha256, input.report.translationSha256); assert.equal(entry.sourceCatalogSha256, input.report.sourceCatalogSha256);
  assert.ok(entry.cards.every(card => card.kind === 'translation')); assert.equal(entry.cards.length, 2);
  const catalog = JSON.parse(input.catalogBytes), translations = JSON.parse(input.translationBytes);
  for (const row of entry.cards) {
    const card = catalog.cards.find(card => card.number === row.number), variant = card.variants[0];
    assert.equal(row.printingId, variant.id); assert.equal(row.image, variant.image); assert.equal(row.rarity, variant.rarity); assert.equal(row.jpName, card.jpName);
    assert.equal(row.name, translations.cards[row.number].fields.find(field => field.path === 'name').translation);
    assert.deepEqual(row.products, variant.sets); assert.equal(row.preview, undefined);
  }
  assert.deepEqual(result.entries[1], input.previous.entries[0]); assert.equal(JSON.stringify(input.previous), before, 'history is never mutated');
  assert.match(entry.summary.join(' '), /沒有新增卡號或卡圖/); assert.match(entry.summary.join(' '), /AI 翻譯/); assert.match(entry.summary.join(' '), /未經人工覆核/); assert.match(entry.summary.join(' '), /僅供顯示/); assert.match(entry.summary.join(' '), /不代表效果已實作/);
});

test('translation append is idempotent and later releases preserve all prior entries exactly', () => {
  const input = translationInput(), once = appendWebsiteTranslationUpdate(input);
  assert.equal(JSON.stringify(appendWebsiteTranslationUpdate({ ...input, previous: once })), JSON.stringify(once));
  const future = translationInput({ previous: once, revision: 'test-only-translations-2', date: '2026-10-31T00:00:00Z' });
  const twice = appendWebsiteTranslationUpdate(future); assert.equal(twice.entries.length, 3); assert.deepEqual(twice.entries.slice(1), once.entries);
  assert.deepEqual(input.previous, legacyHistory);
});

test('an empty translation delta cannot invent an entry or a translated-field count', () => {
  const input = translationInput(); input.report.translatedCardNumbers = []; input.report.translatedFieldCount = 0;
  assert.deepEqual(appendWebsiteTranslationUpdate(input), input.previous);
  input.report.translatedFieldCount = 1; assert.throws(() => appendWebsiteTranslationUpdate(input), /Empty translation update/);
});

for (const [name, mutate, pattern] of [
  ['incorrect catalog digest', input => { input.report.sourceCatalogSha256 = '0'.repeat(64); }, /exact source catalog bytes/],
  ['incorrect translation digest', input => { input.report.translationSha256 = '0'.repeat(64); }, /exact translation bytes/],
  ['incorrect revision', input => { input.report.translationRevision = 'wrong'; }, /revision/],
  ['non-string revision', input => { input.report.translationRevision = 20261030; }, /translation-only report/],
  ['duplicate card number', input => { input.report.translatedCardNumbers.push(input.report.translatedCardNumbers[0]); }, /Duplicate or invalid/],
  ['unknown card number', input => { input.report.translatedCardNumbers[0] = 'hSD99-999'; }, /Missing verified/],
  ['partial translation', input => changeTranslation(input, data => { data.cards[input.report.translatedCardNumbers[0]].fields.pop(); }), /Incomplete/],
  ['changed Japanese source', input => changeTranslation(input, data => { data.cards[input.report.translatedCardNumbers[0]].fields[0].original += '改'; }), /source\/field/],
  ['duplicate translation path', input => changeTranslation(input, data => { const record = data.cards[input.report.translatedCardNumbers[0]]; record.fields.push(record.fields[0]); }), /source\/field/],
  ['empty translated text', input => changeTranslation(input, data => { data.cards[input.report.translatedCardNumbers[0]].fields[0].translation = ' '; }), /source\/field/],
  ['gameplay implementation claim', input => changeTranslation(input, data => { data.cards[input.report.translatedCardNumbers[0]].engineSupportStatus = 'implemented'; }), /Missing verified/],
  ['human-approval claim', input => changeTranslation(input, data => { data.cards[input.report.translatedCardNumbers[0]].humanReviewStatus = 'human-approved'; }), /Missing verified/],
  ['non-display translation data', input => changeTranslation(input, data => { data.meta.changesGameplay = true; }), /display-only scope/],
  ['wrong field count', input => { input.report.translatedFieldCount++; }, /field count/],
  ['new-card claim', input => { input.report.newCardNumbers = ['hSD99-999']; }, /cannot claim/],
  ['new-printing claim', input => { input.report.addedVariants = [{}]; }, /cannot claim/],
  ['untrusted picture', input => changeCatalog(input, data => { data.cards[0].variants[0].image = 'https://example.invalid/card.png'; }), /Untrusted/],
  ['credential-bearing picture', input => changeCatalog(input, data => { data.cards[0].variants[0].image = data.cards[0].variants[0].image.replace('https://', 'https://user:secret@'); }), /Untrusted/],
  ['missing printing', input => changeCatalog(input, data => { data.cards[0].variants = []; }), /no verified/],
  ['duplicate existing IDs', input => { input.previous.entries.push(input.previous.entries[0]); }, /duplicate existing/],
]) test(`translation changelog rejects ${name}`, () => { const input = translationInput(); mutate(input); assert.throws(() => appendWebsiteTranslationUpdate(input), pattern); });

test('changing translation bytes requires a new revision instead of rewriting history', () => {
  const input = translationInput(), once = appendWebsiteTranslationUpdate(input);
  const changed = translationInput({ previous: once }); changeTranslation(changed, data => { data.cards[changed.report.translatedCardNumbers[0]].fields[0].translation += '修訂'; });
  assert.throws(() => appendWebsiteTranslationUpdate(changed), /revision must change/);
  assert.deepEqual(once.entries[1], legacyHistory.entries[0]);
});

test('translation CLI verifies both exact digests before writing and is byte-idempotent', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'translation-update-log-')); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const input = translationInput(), report = path.join(directory, 'report.json'), cards = path.join(directory, 'cards.json'), translations = path.join(directory, 'translations.json'), output = path.join(directory, 'updates.json');
  fs.writeFileSync(report, JSON.stringify(input.report)); fs.writeFileSync(cards, input.catalogBytes); fs.writeFileSync(translations, input.translationBytes); fs.writeFileSync(output, JSON.stringify(input.previous));
  const run = () => spawnSync(process.execPath, [script, report, cards, output, `--translations=${translations}`], { encoding: 'utf8' });
  let result = run(); assert.equal(result.status, 0, result.stderr); const bytes = fs.readFileSync(output);
  result = run(); assert.equal(result.status, 0, result.stderr); assert.deepEqual(fs.readFileSync(output), bytes);
  fs.appendFileSync(translations, ' '); result = run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /exact translation bytes/); assert.deepEqual(fs.readFileSync(output), bytes);
});
