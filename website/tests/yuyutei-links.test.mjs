import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { yuyuteiLink } from '../lib/yuyutei-links.mjs';
import { verifiedYuyuteiProducts } from '../scripts/validate-yuyutei-evidence.mjs';

const catalog = JSON.parse(readFileSync('public/cards.json', 'utf8'));
const manifest = JSON.parse(readFileSync('lib/yuyutei-products.json', 'utf8'));
const card = number => catalog.cards.find(card => card.number === number);
const enabled = new Map(manifest.products.map(product => [`${product.number}|${product.printingId}`, product]));
const unmappedLink = (card, printing) => yuyuteiLink(card, printing, new Map());

test('historical inferences stay rejected; real printings use only a newly verified subset or native search', () => {
  const keys = new Set(), urls = new Set();
  assert.equal(enabled.size, manifest.products.length);
  assert.deepEqual(verifiedYuyuteiProducts(manifest.products.map(product => ({
    ...product.evidence, url: product.url, number: product.number, rarity: product.rarity,
    printingId: product.printingId, officialImage: product.officialImage,
  })), catalog), manifest.products, 'Every enabled record needs complete consistent primary artwork evidence');
  for (const product of manifest.rejectedCandidates) {
    const c = card(product.number), v = c.variants.find(v => v.id === product.printingId);
    assert.equal(c.jpName, product.retailerName);
    assert.equal(v.rarity, product.rarity);
    assert.equal(v.image, product.officialImage);
    const candidates = catalog.cards.filter(c => c.jpName === product.retailerName && c.number.startsWith(`${product.retailerSet}-`))
      .flatMap(c => c.variants.filter(v => v.rarity === product.rarity && v.image.includes(`/${product.retailerSet}/`)));
    assert.equal(candidates.length, 1, 'A unique catalog candidate still does not prove retailer artwork');
    assert.equal(product.printingVerified, false);
    const link = unmappedLink(c, v);
    assert.equal(link.kind, 'search');
    assert.equal(new URL(link.href).searchParams.get('search_word'), c.number);
    assert.ok(link.note.includes(v.rarity));
    assert.match(product.url, /^https:\/\/yuyu-tei\.jp\/sell\/hocg\/card\/[a-z0-9-]+\/\d{5}$/);
    const key = `${product.number}|${product.printingId}`;
    assert.ok(!keys.has(key) && !urls.has(product.url)); keys.add(key); urls.add(product.url);
  }
  assert.equal(keys.size, 8);
  let direct = 0;
  for (const c of catalog.cards) for (const v of c.variants) {
    const product = enabled.get(`${c.number}|${v.id}`), link = yuyuteiLink(c, v);
    assert.equal(link.kind, product ? 'product' : 'search');
    assert.ok(link.note.includes(v.rarity));
    if (product) { direct++; assert.equal(link.href, product.url); }
    else assert.equal(new URL(link.href).searchParams.get('search_word'), c.number);
  }
  assert.equal(direct, manifest.products.length);
  assert.equal(catalog.meta.uniqueCards, 1394);
  assert.equal(catalog.meta.printings, 2981);
});

test('unmapped normal and parallel printings use native number search with distinct rarity labels', () => {
  const luna = card('hBP03-001');
  assert.equal(unmappedLink(luna, luna.variants[0]).href, 'https://yuyu-tei.jp/sell/hocg/s/search?search_word=hBP03-001');
  assert.equal(unmappedLink(luna, luna.variants[1]).href, unmappedLink(luna, luna.variants[0]).href);
  assert.match(unmappedLink(luna, luna.variants[0]).note, /OSR.*選擇對應版本/);
  assert.match(unmappedLink(luna, luna.variants[1]).note, /OUR.*選擇對應版本/);
  const irys = card('hBP08-001');
  assert.equal(unmappedLink(irys, irys.variants[0]).kind, 'search');
  const link = unmappedLink(irys, irys.variants[1]);
  assert.equal(link.kind, 'search');
  assert.equal(new URL(link.href).searchParams.get('search_word'), 'hBP08-001');
  assert.match(link.note, /OUR/);
});

test('confirmed normal, autograph and reprint pages stay attached to their exact catalog editions', () => {
  const fuwamoco = card('hBP08-003');
  for (const [id, url] of [
    ['2206', 'https://yuyu-tei.jp/sell/hocg/card/hbp08/10005'],
    ['2333', 'https://yuyu-tei.jp/sell/hocg/card/hbp08/10006'],
    ['2326', 'https://yuyu-tei.jp/sell/hocg/card/hbp08/10007'],
  ]) assert.equal(yuyuteiLink(fuwamoco, fuwamoco.variants.find(v => v.id === id)).href, url);
  for (const [number, id, url] of [
    ['hBP01-028', '2444', 'https://yuyu-tei.jp/sell/hocg/card/hbp08/10240'],
    ['hBP01-028', '2314', 'https://yuyu-tei.jp/sell/hocg/card/hbp08/10229'],
    ['hBP03-037', '2319', 'https://yuyu-tei.jp/sell/hocg/card/hbp08/10234'],
    ['hBP03-040', '2320', 'https://yuyu-tei.jp/sell/hocg/card/hbp08/10235'],
  ]) {
    const c = card(number), v = c.variants.find(v => v.id === id);
    assert.equal(yuyuteiLink(c, v).href, url);
    for (const original of c.variants.filter(original => original.rarity === v.rarity && original.id !== id)) {
      assert.equal(yuyuteiLink(c, original).kind, 'search');
    }
  }
  const errata = card('hBP03-027');
  for (const id of ['591', '709']) assert.equal(yuyuteiLink(errata, errata.variants.find(v => v.id === id)).kind, 'search');
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
  assert.equal(url.origin, 'https://yuyu-tei.jp');
  assert.equal(url.pathname, '/sell/hocg/s/search');
  assert.deepEqual([...url.searchParams.keys()], ['search_word']);
  assert.equal(url.hash, '');
  assert.equal(url.searchParams.get('search_word'), 'hPR-999');
  assert.ok(link.note.includes('P & # + 遊遊亭'));
  for (const number of ['', 'javascript:alert(1)', 'hPR-001&redirect=evil']) {
    assert.equal(yuyuteiLink({ number }, undefined).href, null);
    assert.equal(yuyuteiLink({ number }, undefined).kind, 'unavailable');
  }
});
