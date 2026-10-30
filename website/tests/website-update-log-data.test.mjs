import { restoreTranslationBaseline } from './translation-preservation-helpers.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { appendWebsiteCardUpdate } from '../scripts/build-website-update-log.mjs';

const catalogBytes = restoreTranslationBaseline('website/public/cards.json', fs.readFileSync(new URL('../public/cards.json', import.meta.url)));
const catalog = JSON.parse(catalogBytes);
const report = JSON.parse(fs.readFileSync(new URL('../docs/card-refresh-2026-10-29/report.json', import.meta.url), 'utf8'));
const actual = JSON.parse(restoreTranslationBaseline('website/public/website-updates.json', fs.readFileSync(new URL('../public/website-updates.json', import.meta.url), 'utf8')));
const script = fileURLToPath(new URL('../scripts/build-website-update-log.mjs', import.meta.url));
const note = '網站底部新增更新記錄按鈕，可查看新增卡號及卡圖表格。';

function input(overrides = {}) { return { report: structuredClone(report), catalog: structuredClone(catalog), notes: [note], ...overrides }; }

test('public update log contains one real dated update with exact 22-card / 57-printing / 35-existing-printing counts', () => {
  const built = appendWebsiteCardUpdate(input());
  assert.deepEqual(built, actual);
  assert.equal(actual.schemaVersion, 1); assert.equal(actual.entries.length, 1);
  const entry = actual.entries[0]; assert.equal(entry.date, '2026-10-29');
  assert.deepEqual(entry.counts, { newCards: 22, newPrintings: 57, newPrintingsForExistingCards: 35 });
  assert.equal(entry.cards.length, 57);
  assert.equal(entry.cards.filter(card => card.kind === 'new-card').length, 22);
  assert.equal(entry.cards.filter(card => card.kind === 'new-printing').length, 35);
  assert.equal(new Set(entry.cards.map(card => card.printingId)).size, 57);
  assert.equal(entry.cards.filter(card => card.preview && card.releaseDate === '2026-10-30').length, 23);
  assert.equal(entry.catalogSha256, report.resultCatalogSha256);
  assert.deepEqual(entry.cards.filter(card => card.kind === 'new-card').map(card => card.number).sort(), report.newCardNumbers);
  for (const row of entry.cards) {
    const card = catalog.cards.find(card => card.number === row.number);
    const variant = card.variants.find(variant => variant.id === row.printingId);
    assert.equal(row.name, card.name); assert.equal(row.jpName, card.jpName);
    assert.equal(row.image, variant.image); assert.equal(row.rarity, variant.rarity);
    assert.deepEqual(row.products, variant.sets);
    assert.equal(new URL(row.image).origin, 'https://hololive-official-cardgame.com');
  }
});

test('repeating an update is byte-deterministic and never duplicates or overwrites existing history', () => {
  const once = appendWebsiteCardUpdate(input());
  assert.equal(JSON.stringify(appendWebsiteCardUpdate(input({ previous: once }))), JSON.stringify(once));
  const noNotes = appendWebsiteCardUpdate(input({ previous: once, notes: [] }));
  assert.deepEqual(noNotes, once, 'a later default run cannot erase the original website-change note');
});

test('future reports append newest-first while retaining each previous entry unchanged', () => {
  const prior = appendWebsiteCardUpdate(input());
  const future = input({ previous: prior }); future.report.capturedAt = '2026-11-01T00:00:00Z';
  // Synthetic future capture used only to test append ordering; never published.
  future.report.resultCatalogSha256 = 'a'.repeat(64);
  const result = appendWebsiteCardUpdate(future);
  assert.equal(result.entries.length, 2); assert.equal(result.entries[0].date, '2026-11-01');
  assert.deepEqual(result.entries[1], prior.entries[0]);
  assert.deepEqual(prior, actual, 'input history is not mutated');
});

test('a no-additions report does not invent another historical entry', () => {
  const value = input({ previous: actual }); value.report.newCardNumbers = []; value.report.addedVariants = [];
  assert.deepEqual(appendWebsiteCardUpdate(value), actual);
});

for (const [name, mutate, pattern] of [
  ['unknown printing identity', value => { value.report.addedVariants[0].id = 'unknown'; }, /identity does not match/],
  ['wrong artwork assignment', value => { value.report.addedVariants[0].image = value.report.addedVariants[1].image; }, /identity does not match/],
  ['duplicate printing', value => { value.report.addedVariants.push(structuredClone(value.report.addedVariants[0])); }, /identity does not match/],
  ['a missing new-card printing', value => { value.report.newCardNumbers.push('hSD99-999'); }, /no verified changelog printing/],
  ['duplicate existing entry IDs', value => { value.previous = { schemaVersion: 1, entries: [actual.entries[0], actual.entries[0]] }; }, /duplicate existing/],
]) test(`update log rejects ${name}`, () => { const value = input(); mutate(value); assert.throws(() => appendWebsiteCardUpdate(value), pattern); });

test('CLI checks exact catalog SHA before writing and is byte-idempotent', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'website-update-log-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const reportPath = path.join(directory, 'report.json'), catalogPath = path.join(directory, 'cards.json'), outputPath = path.join(directory, 'updates.json');
  fs.writeFileSync(reportPath, JSON.stringify(report)); fs.writeFileSync(catalogPath, catalogBytes);
  const run = () => spawnSync(process.execPath, [script, reportPath, catalogPath, outputPath, `--note=${note}`], { encoding: 'utf8' });
  let result = run(); assert.equal(result.status, 0, result.stderr);
  const once = fs.readFileSync(outputPath); result = run(); assert.equal(result.status, 0, result.stderr); assert.deepEqual(fs.readFileSync(outputPath), once);
  fs.appendFileSync(catalogPath, ' '); result = run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /exact catalog bytes/); assert.deepEqual(fs.readFileSync(outputPath), once);
});
