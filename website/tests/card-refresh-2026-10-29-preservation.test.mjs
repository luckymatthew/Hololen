import { restoreTranslationBaseline } from './translation-preservation-helpers.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { canonical, hash, restoreV2Baseline } from './card-refresh-test-helpers.mjs';

const catalogBytes = restoreTranslationBaseline('website/public/cards.json', fs.readFileSync(new URL('../public/cards.json', import.meta.url)));
const catalog = JSON.parse(catalogBytes);
const baseline = JSON.parse(fs.readFileSync(new URL('./fixtures/card-refresh-2026-10-29-baseline.json', import.meta.url), 'utf8'));
const reportURL = new URL('../docs/card-refresh-2026-10-29/report.json', import.meta.url);
const report = fs.existsSync(reportURL) ? JSON.parse(fs.readFileSync(reportURL, 'utf8')) : null;
const without = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const byNumber = new Map(catalog.cards.map(card => [card.number, card]));

test('2026-10-29 baseline pins exact reviewed release1.2.7 production bytes and counts', () => {
  assert.equal(baseline.sourceCommit, 'a789bcbac3f8ca5216f3188f30bb6177e97a40c9');
  assert.equal(baseline.catalogSha256, 'c6db1d1cf260ae591291a35d05823f572158a1708e85e0986f60c9179944de0a');
  assert.equal(baseline.bytes, 2110796); assert.equal(baseline.cards, 1394); assert.equal(baseline.printings, 2981);
  assert.equal(baseline.cardOrder.length, 1394); assert.equal(Object.keys(baseline.printingCoreSha256).length, 2981);
});

test('all1394 previous cards preserve every non-membership field, stable identity, effect, name and alias', () => {
  for (const [number, expected] of Object.entries(baseline.immutableCardSha256)) {
    assert.ok(byNumber.has(number), `Lost existing card ${number}`);
    assert.equal(hash(canonical(without(byNumber.get(number), ['variants', 'sets']))), expected, `${number}: only additive product membership and printings may change`);
  }
  assert.equal(catalog.cards.filter(card => card.simOnly).length, 7);
});

test('all2981 old printings retain original ordered IDs, images, rarities and non-source metadata', () => {
  for (const [number, ids] of Object.entries(baseline.printingOrder)) {
    const card = byNumber.get(number), existingIds = new Set(ids);
    assert.deepEqual(card.variants.filter(variant => existingIds.has(variant.id)).map(variant => variant.id), ids, `${number}: keep old printing order and identities`);
    for (const id of ids) {
      const variant = card.variants.find(variant => variant.id === id); assert.ok(variant, `Lost existing printing ${number}/${id}`);
      assert.equal(hash(canonical(without(variant, ['sets', 'sourceUrl']))), baseline.printingCoreSha256[id], `${number}/${id}: opaque printing identity and official art must not change`);
      if (Object.hasOwn(baseline.existingPrintingSourceUrlSha256, id)) assert.equal(hash(variant.sourceUrl), baseline.existingPrintingSourceUrlSha256[id], `${number}/${id}: preserve every existing official detail URL`);
    }
  }
});

test('v2 rollback recreates exact previous canonical catalog and result SHA matches published payload', { skip: !report }, () => {
  assert.equal(report.baselineCatalogSha256, baseline.catalogSha256);
  assert.equal(report.baselineCanonicalCatalogSha256, baseline.canonicalCatalogSha256);
  assert.equal(hash(canonical(restoreV2Baseline(catalog, report))), baseline.canonicalCatalogSha256);
  assert.equal(report.resultCatalogSha256, hash(catalogBytes));
  assert.equal(report.resultCanonicalCatalogSha256, hash(canonical(catalog)));
  assert.deepEqual(report.removedVariants, []);
});

test('v2 full official reconciliation has exact source counts and no duplicate or missing cards or printings', { skip: !report }, () => {
  const variants = catalog.cards.flatMap(card => card.variants);
  assert.equal(catalog.cards.length, report.result.cards); assert.equal(variants.length, report.result.printings);
  assert.equal(report.officialSource.numberedPrintings, variants.length);
  assert.equal(catalog.meta.officialSourcePrintings, report.officialSource.listingRows);
  assert.equal(new Set(catalog.cards.map(card => card.number)).size, catalog.cards.length);
  assert.equal(new Set(catalog.cards.map(card => card.id)).size, catalog.cards.length);
  assert.equal(new Set(variants.map(variant => variant.id)).size, variants.length);
  assert.equal(new Set(catalog.cards.flatMap(card => card.variants.map(variant => `${card.number}|${variant.image}`))).size, variants.length);
  assert.deepEqual(catalog.cards.filter(card => !Object.hasOwn(baseline.immutableCardSha256, card.number)).map(card => card.number).sort(), report.newCardNumbers);
  assert.equal(catalog.cards.length, baseline.cards + report.newCards.length);
  assert.equal(variants.length, baseline.printings + report.addedVariants.length);
  for (const item of report.addedVariants) {
    const variant = byNumber.get(item.number)?.variants.find(variant => variant.id === item.id);
    assert.ok(variant, `Missing reconciled official printing ${item.number}/${item.id}`);
    assert.equal(variant.image, item.image); assert.equal(variant.rarity, item.rarity); assert.deepEqual(variant.sets, item.sets);
  }
  for (const product of Object.values(report.products)) assert.equal(product.catalogPrintings, product.officialPrintings);
});

test('new cards retain official Japanese fallback, unverified simulation status and release-date preview gate', { skip: !report }, () => {
  const captureDate = report.capturedAt.slice(0, 10);
  for (const number of report.newCardNumbers) {
    const card = byNumber.get(number);
    assert.equal(card.officialImportSchema, 2); assert.equal(card.effectLanguage, 'ja');
    assert.equal(card.translationStatus, 'official-japanese-fallback'); assert.equal(card.simulationStatus, 'not-audited');
    assert.equal(card.preview, Boolean(card.releaseDate && card.releaseDate > captureDate));
    assert.equal(card.simOnly, false); assert.equal(card.restricted, false);
    assert.ok(['reviewed-mapping', 'official-japanese-fallback'].includes(card.nameTranslationStatus));
    if (card.nameTranslationStatus === 'official-japanese-fallback') assert.equal(card.name, card.jpName);
  }
  for (const number of ['hBP01-030', 'hBP07-101']) { assert.equal(byNumber.get(number).maxCopies, 1); assert.equal(byNumber.get(number).restricted, true); }
});
