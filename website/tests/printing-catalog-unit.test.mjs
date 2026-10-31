import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { catalogPrintings, filterCatalogPrintings, sortVariantsByRarity, variantLabel } from '../lib/printing-catalog.mjs';

const catalog = JSON.parse(readFileSync('public/cards.json', 'utf8'));

test('printing expansion preserves all original card and variant references, IDs and bytes', () => {
  const before = JSON.stringify(catalog), entries = catalogPrintings(catalog.cards);
  assert.equal(catalog.cards.length, 1416);
  assert.equal(entries.length, 3045);
  assert.equal(entries.filter(entry => entry.variant).length, 3038);
  assert.equal(entries.filter(entry => !entry.variant).length, 7);
  assert.equal(new Set(entries.map(entry => `${entry.card.number}:${entry.id}`)).size, 3045);
  assert.equal(new Set(entries.map(entry => entry.card)).size, 1416);
  for (const card of catalog.cards) {
    const actual = entries.filter(entry => entry.card.number === card.number);
    assert.equal(actual.length, Math.max(1, card.variants.length));
    for (const entry of actual) {
      assert.equal(entry.card, card);
      if (entry.variant) {
        assert.equal(entry.variant, card.variants.find(variant => variant.id === entry.id));
        assert.equal(entry.id, entry.variant.id);
        assert.equal(entry.variant.image, card.variants.find(variant => variant.id === entry.id).image);
      } else {
        assert.equal(card.variants.length, 0);
        assert.equal(entry.id, card.id, 'imageless fallback reuses the canonical key, without inventing a printing');
      }
    }
  }
  assert.equal(JSON.stringify(catalog), before, 'expansion and sorting never mutate catalog data');
});

test('same-rarity labels use stable numeric printing order and source-set search excludes sibling printings', () => {
  const card = structuredClone(catalog.cards.find(card => card.number === 'hBP09-079'));
  card.set = 'Combined sources'; card.sets = ['Alpha-exclusive', 'Beta-exclusive'];
  card.variants = [
    { id: 'printing-10', rarity: 'P', image: 'beta.png', sets: ['Beta-exclusive'] },
    { id: 'printing-2', rarity: 'P', image: 'alpha.png', sets: ['Alpha-exclusive'] },
  ];
  const before = JSON.stringify(card), sorted = sortVariantsByRarity(card.variants), entries = catalogPrintings([card]);
  assert.deepEqual(sorted.map(variant => variant.id), ['printing-2', 'printing-10']);
  assert.deepEqual(sorted.map(variant => variantLabel(variant, sorted)), ['P 1', 'P 2']);
  assert.deepEqual(entries.map(entry => [entry.id, entry.label]), [['printing-2', 'P 1'], ['printing-10', 'P 2']]);
  assert.deepEqual(filterCatalogPrintings(entries, { query: 'Alpha-exclusive' }).map(entry => entry.id), ['printing-2']);
  assert.deepEqual(filterCatalogPrintings(entries, { query: 'Beta-exclusive' }).map(entry => entry.id), ['printing-10']);
  assert.deepEqual(filterCatalogPrintings(entries, { query: 'printing-10' }).map(entry => entry.id), ['printing-10']);
  assert.equal(JSON.stringify(card), before);
});

test('newest ordering uses each printing release date before its parent card date', () => {
  const card = structuredClone(catalog.cards.find(card => card.number === 'hBP09-079'));
  card.releaseDate = '2026-01-01';
  card.variants = [
    { id: 'printing-2', rarity: 'P', image: 'earlier.png', releaseDate: '2024-01-01' },
    { id: 'printing-10', rarity: 'P', image: 'later.png', releaseDate: '2027-01-01' },
    { id: 'printing-3', rarity: 'P', image: 'fallback.png' },
  ];
  const entries = catalogPrintings([card]);
  assert.deepEqual(filterCatalogPrintings(entries, { sort: 'number' }).map(entry => entry.id), ['printing-2', 'printing-3', 'printing-10']);
  assert.deepEqual(filterCatalogPrintings(entries, { sort: 'newest' }).map(entry => entry.id), ['printing-10', 'printing-3', 'printing-2']);
  assert.equal(entries.find(entry => entry.id === 'printing-3').releaseDate, card.releaseDate);
  assert.equal(card.releaseDate, '2026-01-01');
});
