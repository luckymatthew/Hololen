import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeVerifiedYuyuteiManifest } from '../scripts/import-yuyutei-evidence.mjs';
import { yuyuteiLink } from '../lib/yuyutei-links.mjs';

const catalog = JSON.parse(readFileSync('public/cards.json', 'utf8'));
const source = JSON.parse(readFileSync('lib/yuyutei-products.json', 'utf8'));
const luna = catalog.cards.find(card => card.number === 'hBP03-001');
// Isolated synthetic confirmation; never persisted in the real product manifest.
const record = {
  number: luna.number, rarity: 'OUR', printingId: '678',
  url: 'https://yuyu-tei.jp/sell/hocg/card/hbp03/10002', title: 'OUR 姫森ルーナ(パラレル)',
  retailerImage: 'https://yuyu-tei.jp/synthetic-fixture.png', method: 'primary-browser', artworkConfirmed: true,
  observedAt: '2026-10-03T12:00:00Z', reference: 'Synthetic test fixture; not source verification',
};

test('confirmed subset import preserves provenance and IDs; other printings keep native fallback', () => {
  const manifest = { ...source, products: [] }, before = JSON.stringify(manifest);
  const merged = mergeVerifiedYuyuteiManifest(manifest, [record], catalog);
  assert.equal(JSON.stringify(manifest), before);
  assert.deepEqual(merged.rejectedCandidates, manifest.rejectedCandidates);
  assert.deepEqual(merged.primaryEvidence, manifest.primaryEvidence);
  assert.deepEqual(merged.artworkSources, manifest.artworkSources);
  assert.deepEqual(merged.mappingEvidence.sourcePackets, manifest.mappingEvidence?.sourcePackets);
  assert.equal(merged.products.length, 1);
  assert.equal(merged.products[0].printingId, '678');
  const index = new Map(merged.products.map(product => [`${product.number}|${product.printingId}`, product]));
  assert.equal(yuyuteiLink(luna, luna.variants.find(v => v.id === '678'), index).href, record.url);
  assert.equal(yuyuteiLink(luna, luna.variants.find(v => v.id === '565'), index).kind, 'search');
  assert.deepEqual(mergeVerifiedYuyuteiManifest(merged, [record], catalog), merged);
});

test('import blocks conflicting printing prices, reused URLs and existing unverified mappings', () => {
  const merged = mergeVerifiedYuyuteiManifest({ ...source, products: [] }, [record], catalog);
  assert.throws(() => mergeVerifiedYuyuteiManifest(merged, [{ ...record, url: 'https://yuyu-tei.jp/sell/hocg/card/hbp03/19999' }], catalog), /Conflicting/);
  assert.throws(() => mergeVerifiedYuyuteiManifest(merged, [{ ...record, printingId: '565', rarity: 'OSR', title: 'OSR 姫森ルーナ' }], catalog), /reused retailer URL/);
  assert.throws(() => mergeVerifiedYuyuteiManifest({ ...merged, products: [{ ...merged.products[0], printingVerified: false }] }, [], catalog), /Existing product/);
  assert.throws(() => mergeVerifiedYuyuteiManifest({ ...source, products: [] }, [{ ...record, artworkConfirmed: false }], catalog), /artwork/);
});
