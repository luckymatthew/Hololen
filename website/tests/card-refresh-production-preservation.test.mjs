import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (name) => fs.readFileSync(path.join(root, name));
const catalog = JSON.parse(read('website/public/cards.json'));
const fixture = JSON.parse(read('website/tests/fixtures/card-refresh-production-baseline.json'));
const reportBytes = read('website/docs/card-refresh-report.json');
const report = JSON.parse(reportBytes);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const normalize = (value) => Array.isArray(value) ? value.map(normalize) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])])) : value;
const canonical = (value) => JSON.stringify(normalize(value));
const newNumbers = ['hY03-018', 'hY04-015'];
const additions = [...report.products.pr.added, ...report.products.heb01.added];
const immutableCard = (card) => Object.fromEntries(Object.entries(card).filter(([key]) => !['variants', 'sets', 'image', 'rarity'].includes(key)));
function reverseVerifiedRuleCorrection(card) {
  const correction = fixture.approvedRuleCorrections.corrections.find((entry) => entry.number === card.number);
  if (!correction) return card;
  const original = structuredClone(card);
  const art = original.arts[correction.artIndex];
  assert.deepEqual({ specialTargets: art.specialTargets, specialValues: art.specialValues }, correction.after,
    `${card.number}: exactly the independently verified printed +50 is required`);
  Object.assign(art, correction.before);
  return original;
}
function verifyCardFields(cards) {
  const byNumber = new Map(cards.map((card) => [card.number, card]));
  for (const [number, expected] of Object.entries(fixture.baseline.immutableCardSha256)) {
    assert.ok(byNumber.has(number), `Missing production card ${number}`);
    assert.equal(hash(canonical(immutableCard(reverseVerifiedRuleCorrection(byNumber.get(number))))), expected, `${number}: existing names, rules, effects, stable ids and non-printing fields must remain unchanged`);
  }
}
function restoreBaseline(input) {
  const original = structuredClone(input);
  original.cards = original.cards.filter((card) => !newNumbers.includes(card.number));
  const byNumber = new Map(original.cards.map((card) => [card.number, card]));
  const addedIds = new Set(additions.map((item) => item.id));
  for (const card of original.cards) card.variants = card.variants.filter((variant) => !addedIds.has(variant.id));
  for (const item of fixture.rollback.printingMetadata) {
    const printing = byNumber.get(item.number).variants.find((variant) => variant.id === item.id);
    assert.ok(printing, `Missing existing printing ${item.number}/${item.id}`);
    assert.deepEqual(printing[item.key], item.after, `${item.number}/${item.id}: exact reviewed metadata`);
    if (item.had) printing[item.key] = item.before; else delete printing[item.key];
  }
  for (const item of fixture.rollback.cardMetadata) {
    const card = byNumber.get(item.number);
    assert.deepEqual(card[item.key], item.after, `${item.number}: exact reviewed ${item.key}`);
    if (item.had) card[item.key] = item.before; else delete card[item.key];
  }
  for (const item of fixture.rollback.removedPrintings) byNumber.get(item.number).variants.splice(item.index, 0, item.printing);
  original.cards = fixture.baseline.cardOrder.map((number) => reverseVerifiedRuleCorrection(byNumber.get(number)));
  const refreshKeys = ['generatedAt', 'snapshotDate', 'catalogVersion', 'uniqueCards', 'sourceUniqueCards', 'printings', 'officialSourceUrl', 'officialSourcePrintings', 'traditionalChineseCards', 'japaneseNameFallbackCards'];
  for (const key of refreshKeys) {
    if (Object.hasOwn(fixture.baseline.meta, key)) original.meta[key] = fixture.baseline.meta[key]; else delete original.meta[key];
  }
  return original;
}
// Offline signatures pinned to production, not a new capture of the official list.
test('refresh baseline is the exact catalog served by production 1.2.6', () => {
  assert.equal(fixture.baseline.sourceCommit, '238915a9f71fe4158d45f8f18fad6d2af7d10aaf');
  assert.equal(fixture.baseline.catalogSha256, 'badca2019627e6fc431779d31a24bb51b23c3ea4609589c00e27b82a463868d7');
  assert.equal(fixture.reviewedRefresh.captureAvailableLocally, false);
  assert.equal(hash(reportBytes), fixture.reviewedRefresh.reportSha256);
  assert.equal(fixture.baseline.cards, 1392); assert.equal(fixture.baseline.printings, 2906);
});
test('all 1392 production cards preserve every field except exactly four independently verified printed bonuses', () => { verifyCardFields(catalog.cards); });
test('reversing only reviewed printing metadata and four verified printed bonuses recreates production exactly', () => {
  assert.equal(hash(canonical(restoreBaseline(catalog))), fixture.baseline.canonicalCatalogSha256);
});
test('refresh contains exactly the 81 reviewed additions, six removed S printings and two new Cheer cards', () => {
  assert.equal(catalog.cards.length, 1394);
  assert.deepEqual(Object.fromEntries(['generatedAt', 'snapshotDate', 'catalogVersion', 'uniqueCards', 'sourceUniqueCards', 'printings', 'officialSourceUrl', 'officialSourcePrintings', 'traditionalChineseCards', 'japaneseNameFallbackCards'].map((key) => [key, catalog.meta[key]])), {
    generatedAt: report.capturedAt, snapshotDate: '2026-10-01', catalogVersion: report.catalogVersion,
    uniqueCards: 1394, sourceUniqueCards: 1387, printings: 2981,
    officialSourceUrl: report.officialSource.url, officialSourcePrintings: 2982,
    traditionalChineseCards: 1372, japaneseNameFallbackCards: 22,
  });

  assert.equal(catalog.cards.reduce((total, card) => total + card.variants.length, 0), 2981);
  assert.deepEqual(catalog.cards.filter((card) => !Object.hasOwn(fixture.baseline.immutableCardSha256, card.number)).map((card) => card.number).sort(), newNumbers);
  assert.equal(report.products.pr.added.length, 75); assert.equal(report.products.heb01.added.length, 6); assert.equal(report.products.heb01.removed.length, 6);
  for (const item of additions) {
    const card = catalog.cards.find((card) => card.number === item.number);
    assert.deepEqual(card.variants.filter((variant) => variant.id === item.id), [{ id: item.id, rarity: item.rarity, image: item.image, sets: [item.product], sourceUrl: item.sourceUrl }]);
  }
  const variants = catalog.cards.flatMap((card) => card.variants);
  for (const removed of report.products.heb01.removed) assert.ok(!variants.some((variant) => variant.id === removed.id || variant.image === removed.image));
  for (const item of fixture.rollback.newCards) {
    const card = catalog.cards.find((candidate) => candidate.number === item.number);
    assert.equal(hash(canonical(card)), item.sha256); assert.equal(card.nameTranslationStatus, 'reviewed-mapping'); assert.equal(card.simulationStatus, 'not-audited');
  }
  assert.equal(new Set(catalog.cards.map((card) => card.id)).size, catalog.cards.length);
  assert.equal(new Set(variants.map((variant) => variant.id)).size, variants.length);
  assert.equal(new Set(catalog.cards.flatMap((card) => card.variants.map((variant) => `${card.number}|${variant.image}`))).size, variants.length);
});
test('metadata enrichment is limited to reviewed PR membership, official detail links and corrected Cheer art', () => {
  assert.equal(fixture.rollback.printingMetadata.filter((item) => item.key === 'sets').length, 363);
  assert.equal(fixture.rollback.printingMetadata.filter((item) => item.key === 'sourceUrl').length, 571);
  assert.equal(fixture.rollback.printingMetadata.length, 934);
  for (const item of fixture.rollback.printingMetadata) {
    assert.equal(item.had, false);
    if (item.key === 'sets') assert.deepEqual(item.after, ['PRカード']);
    else { assert.equal(item.key, 'sourceUrl'); const url = new URL(item.after); assert.equal(url.origin, 'https://hololive-official-cardgame.com'); assert.equal(url.pathname, '/cardlist/'); assert.match(url.searchParams.get('id'), /^\d+$/); }
  }
  for (const item of fixture.rollback.cardMetadata) {
    assert.ok(['sets', 'image', 'rarity'].includes(item.key));
    if (item.key !== 'sets') assert.ok(report.products.heb01.removed.some((removed) => removed.number === item.number));
  }
});
test('production Gyudon alias is preserved and exactly four official printed color bonuses are restored', () => {
  assert.equal(catalog.cards.find((card) => card.number === 'hBP09-100').extra, 'このイベントは〈牛丼〉としても扱う');
  assert.deepEqual(fixture.approvedRuleCorrections.corrections.map((entry) => [entry.number, entry.artIndex, entry.after.specialTargets, entry.after.specialValues]), [
    ['hEB01-016', 0, ['白'], [50]], ['hEB01-017', 0, ['紅'], [50]],
    ['hEB01-023', 0, ['白'], [50]], ['hEB01-024', 0, ['白'], [50]],
  ]);
  assert.deepEqual(report.verifiedRuleCorrections, fixture.approvedRuleCorrections);
  for (const correction of fixture.approvedRuleCorrections.corrections) reverseVerifiedRuleCorrection(catalog.cards.find(card => card.number === correction.number));
});
test('preservation guard rejects effect regressions, renamed cards, changed stable IDs and lost cards', () => {
  for (const mutate of [
    (cards) => { cards.find((card) => card.number === 'hBP09-100').extra = ''; },
    (cards) => { cards.find((card) => card.number === 'hEB01-016').arts[0].specialTargets = []; },
    (cards) => { cards.find((card) => card.number === 'hEB01-017').arts[0].specialTargets = ['赤']; },
    (cards) => { cards.find((card) => card.number === 'hEB01-024').arts[0].specialValues = [100]; },
    (cards) => { cards[0].name = 'Unexpected name'; },
    (cards) => { cards[0].id = 'replaced-id'; },
    (cards) => { cards.shift(); },
  ]) { const cards = structuredClone(catalog.cards); mutate(cards); assert.throws(() => verifyCardFields(cards)); }
});
test('all unrelated production runtime, UI, engine, configuration and public files remain byte-identical', () => {
  assert.equal(fixture.protectedRuntime.paths.length, 370);
  assert.deepEqual(fixture.approvedCompatibility.changedPaths, [
    'website/app/account/AccountClient.tsx', 'website/app/page.tsx',
    'website/app/simulator/SimulatorClient.tsx', 'website/lib/firebase/pvp.ts',
  ]);
  assert.deepEqual(fixture.approvedCompatibility.addedPaths, ['website/lib/printing-compatibility.mjs']);
  const exceptions = new Set(fixture.approvedCompatibility.changedPaths);
  const unchanged = fixture.protectedRuntime.paths.filter((name) => !exceptions.has(name));
  assert.equal(unchanged.length, 366);
  // The published 1.2.7 download metadata is the only approved release-file change.
  const releaseMetadataPath = 'website/lib/releases.mjs';
  const releaseMetadataSha256 = '6d944155fcbeac950d9716af579832163998b917786f5a1acce787d676e040cc';
  assert.equal(fixture.protectedRuntime.fileSha256[releaseMetadataPath], 'a9985fe523605957075629c9b8d75836af3eab1df0c32366f6ebed70a10f1d65', 'Keep the historical 1.2.6 metadata baseline unchanged');
  for (const name of unchanged) assert.equal(hash(read(name)), name === releaseMetadataPath ? releaseMetadataSha256 : fixture.protectedRuntime.fileSha256[name], `${name} must match its exact reviewed production bytes`);
  const roots = ['app', 'lib', 'public', 'build', 'db', 'drizzle', 'firebase', 'worker'];
  const walk = (directory) => fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]);
  const actual = roots.flatMap((directory) => walk(`website/${directory}`)).filter((name) => name !== 'website/public/cards.json').sort();
  const expected = [...fixture.protectedRuntime.paths.filter((name) => roots.some((directory) => name.startsWith(`website/${directory}/`))), ...fixture.approvedCompatibility.addedPaths].sort();
  assert.deepEqual(actual, expected, 'Only the reviewed compatibility helper may be introduced');
});
