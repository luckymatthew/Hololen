import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { yuyuteiLink } from '../lib/yuyutei-links.mjs';

const catalog = JSON.parse(readFileSync('public/cards.json', 'utf8'));
const manifest = JSON.parse(readFileSync('lib/yuyutei-products.json', 'utf8'));
const card = number => catalog.cards.find(card => card.number === number);

test('all eight unverified research candidates remain search-only for their inferred catalog printings', () => {
  const keys = new Set(), urls = new Set();
  assert.deepEqual(manifest.products, [], 'Blocked primary-page evidence must not enable direct product links');
  for (const product of manifest.rejectedCandidates) {
    const c = card(product.number), v = c.variants.find(v => v.id === product.printingId);
    assert.equal(c.jpName, product.retailerName);
    assert.equal(v.rarity, product.rarity);
    assert.equal(v.image, product.officialImage);
    const candidates = catalog.cards.filter(c => c.jpName === product.retailerName && c.number.startsWith(`${product.retailerSet}-`))
      .flatMap(c => c.variants.filter(v => v.rarity === product.rarity && v.image.includes(`/${product.retailerSet}/`)));
    assert.equal(candidates.length, 1, 'A unique catalog candidate still does not prove retailer artwork');
    assert.equal(product.printingVerified, false);
    const link = yuyuteiLink(c, v);
    assert.equal(link.kind, 'search');
    assert.equal(new URL(link.href).searchParams.get('q'), `site:yuyu-tei.jp/sell/hocg/card/ "${c.number}" "${v.rarity}"`);
    assert.match(product.url, /^https:\/\/yuyu-tei\.jp\/sell\/hocg\/card\/[a-z0-9-]+\/\d{5}$/);
    const key = `${product.number}|${product.printingId}`;
    assert.ok(!keys.has(key) && !urls.has(product.url)); keys.add(key); urls.add(product.url);
  }
  assert.equal(keys.size, 8);
  for (const c of catalog.cards) for (const v of c.variants) assert.equal(yuyuteiLink(c, v).kind, 'search');
  assert.equal(catalog.meta.uniqueCards, 1394);
  assert.equal(catalog.meta.printings, 2981);
});

test('normal and parallel printings have distinct rarity-specific search queries', () => {
  const luna = card('hBP03-001');
  assert.match(new URL(yuyuteiLink(luna, luna.variants[0]).href).searchParams.get('q'), /"hBP03-001" "OSR"$/);
  assert.match(new URL(yuyuteiLink(luna, luna.variants[1]).href).searchParams.get('q'), /"hBP03-001" "OUR"$/);
  const irys = card('hBP08-001');
  assert.equal(yuyuteiLink(irys, irys.variants[0]).kind, 'search');
  const link = yuyuteiLink(irys, irys.variants[1]);
  assert.equal(link.kind, 'search');
  assert.match(new URL(link.href).searchParams.get('q'), /"hBP08-001" "OUR"$/);
});

test('PR, repeated rarity, unknown IDs, missing printing and changed rarity use a labeled search', () => {
  const promo = card('hPR-001'), luna = card('hBP03-001');
  assert.equal(yuyuteiLink(promo, promo.variants[0]).kind, 'search');
  assert.match(yuyuteiLink(promo, promo.variants[0]).note, /尚未核對.*卡圖/);
  assert.equal(yuyuteiLink(luna, { id: 'unverified', rarity: 'OSR' }).kind, 'search');
  const repeated = { ...luna, variants: [...luna.variants, { id: 'reprint', rarity: 'OSR' }] };
  assert.equal(yuyuteiLink(repeated, repeated.variants[2]).kind, 'search');
  const changed = { ...luna, variants: [{ id: '565', rarity: 'P' }] };
  assert.equal(yuyuteiLink(changed, changed.variants[0]).kind, 'search');
  assert.equal(yuyuteiLink(luna, undefined).kind, 'search');
  assert.equal(yuyuteiLink(card('hBP03-002'), luna.variants[0]).kind, 'search');
});

test('search encoding cannot introduce URL parameters, and invalid card numbers are unavailable', () => {
  const fixture = { number: 'hPR-999', variants: [{ id: 'fixture', rarity: 'P & # + 遊遊亭' }] };
  const link = yuyuteiLink(fixture, fixture.variants[0]);
  const url = new URL(link.href);
  assert.equal(url.origin, 'https://www.google.com');
  assert.deepEqual([...url.searchParams.keys()], ['q']);
  assert.equal(url.hash, '');
  assert.equal(url.searchParams.get('q'), 'site:yuyu-tei.jp/sell/hocg/card/ "hPR-999" "P & # + 遊遊亭"');
  for (const number of ['', 'javascript:alert(1)', 'hPR-001&redirect=evil']) {
    assert.equal(yuyuteiLink({ number }, undefined).href, null);
    assert.equal(yuyuteiLink({ number }, undefined).kind, 'unavailable');
  }
});
