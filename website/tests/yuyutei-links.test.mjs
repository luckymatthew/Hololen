import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import productData from '../lib/yuyutei-card-products.json' with { type: 'json' };
import { canonicalCardNumber, officialArtworkIdentity, yuyuteiCardLink, yuyuteiSearchUrl } from '../lib/yuyutei-links.mjs';

const catalog = JSON.parse(readFileSync('public/cards.json', 'utf8'));
const products = productData.products;

test('the port contains exactly the app’s 15 reviewed artwork-specific products, each present in the unchanged website catalog', () => {
  assert.equal(productData.schemaVersion, 1);
  assert.equal(productData.status, 'verified-android-port');
  assert.equal(products.length, 15);
  assert.equal(productData.artworkAuditDate, '2026-10-03');
  assert.equal(productData.source.assetSha256, '67573177fa7448e746a05cdafc7e6aa4d21a8fe684c252c3a6113911c3415750');
  const canonical = JSON.stringify(products.map(row => Object.fromEntries(Object.keys(row).sort().map(key => [key, row[key]]))));
  assert.equal(createHash('sha256').update(canonical).digest('hex'), '33e7497ea4657c332650247a364479f08629bfb8da3234a95aeeff0156810e74', 'exact data-only projection of the hash-verified shipped APK asset');
  assert.equal(new Set(products.map(row => `${row.cardNumber}|${row.officialImageUrl}`)).size, 15);
  for (const row of products) {
    const card = catalog.cards.find(card => card.number === row.cardNumber);
    assert.ok(card, `${row.cardNumber}: real current card number`);
    const printings = card.variants.filter(variant => officialArtworkIdentity(variant.image) === officialArtworkIdentity(row.officialImageUrl));
    assert.equal(printings.length, 1, 'exactly one current printing, never rarity-only matching');
    assert.equal(printings[0].id, row.printingId); assert.equal(printings[0].rarity, row.rarity);
    const result = yuyuteiCardLink(row.cardNumber, row.officialImageUrl);
    assert.equal(result.kind, 'product'); assert.equal(result.url, row.productUrl);
    const url = new URL(row.productUrl);
    assert.equal(url.origin, 'https://yuyu-tei.jp'); assert.equal(url.username, ''); assert.equal(url.password, '');
    assert.equal(url.search, ''); assert.equal(url.hash, '');
    assert.ok(!Object.keys(row).some(key => /price|stock|yen/i.test(key)), 'no invented or stale price/availability data');
  }
});

test('all unmatched printings use only the app’s native card-number search, without promoting historical rejected guesses', () => {
  assert.equal(yuyuteiSearchUrl('hBP08-003'), 'https://yuyu-tei.jp/sell/hocg/s/search?search_word=hBP08-003');
  const unverified = catalog.cards.flatMap(card => card.variants.map(variant => ({ card, variant }))).filter(({ card, variant }) => !products.some(row => row.cardNumber === card.number && row.officialImageUrl === variant.image));
  assert.equal(unverified.length, 3023);
  for (const { card, variant } of unverified) {
    const result = yuyuteiCardLink(card.number, variant.image);
    assert.equal(result.kind, 'search'); assert.equal(result.url, yuyuteiSearchUrl(card.number));
    assert.deepEqual([...new URL(result.url).searchParams], [['search_word', card.number]]);
  }
});

test('product links require both the exact card number and exact selected official artwork path', () => {
  for (const row of products) {
    assert.notEqual(yuyuteiCardLink(row.cardNumber, row.officialImageUrl.replace(/\.png$/, '-unmatched.png'))?.kind, 'product');
    assert.notEqual(yuyuteiCardLink(row.cardNumber, '')?.kind, 'product');
    assert.notEqual(yuyuteiCardLink(row.cardNumber, undefined)?.kind, 'product');
    assert.notEqual(yuyuteiCardLink('hBP99-999', row.officialImageUrl)?.kind, 'product');
    const result = yuyuteiCardLink(` ${row.cardNumber.toLowerCase()} `, `${row.officialImageUrl}?cache=unchanged#preview`);
    assert.equal(result.kind, 'product'); assert.equal(result.url, row.productUrl);
  }
});

test('untrusted hosts, credentials, paths and protocols cannot impersonate reviewed official artwork', () => {
  for (const row of products) {
    const path = new URL(row.officialImageUrl).pathname;
    for (const image of [`https://example.invalid${path}`, `http://hololive-official-cardgame.com${path}`, `https://hololive-official-cardgame.com.example.invalid${path}`, `https://user:pass@hololive-official-cardgame.com${path}`, `https://hololive-official-cardgame.com/not-official/${path.split('/').at(-1)}`, 'javascript:alert(1)', null]) {
      assert.equal(officialArtworkIdentity(image), ''); assert.notEqual(yuyuteiCardLink(row.cardNumber, image)?.kind, 'product');
    }
    assert.notEqual(yuyuteiCardLink(row.cardNumber, row.officialImageUrl.replace('/cardlist/', '/cardlist/unmatched-set/'))?.kind, 'product', 'basename collisions in another set cannot match');
  }
});

test('a malformed or unsafe future product row fails closed to native search, never breaks card details', () => {
  const row = products[0], originalUrl = row.productUrl;
  try {
    for (const value of ['not-a-url', 'javascript:alert(1)', originalUrl.replace('https:', 'http:'), originalUrl.replace('yuyu-tei.jp', 'yuyu-tei.jp.example.invalid'), originalUrl.replace('https://', 'https://user:pass@'), `${originalUrl}?unverified=1`, `${originalUrl}#unverified`, 'https://yuyu-tei.jp/sell/hocg/unknown/123']) {
      row.productUrl = value;
      const result = yuyuteiCardLink(row.cardNumber, row.officialImageUrl);
      assert.equal(result.kind, 'search'); assert.equal(result.url, yuyuteiSearchUrl(row.cardNumber));
    }
  } finally { row.productUrl = originalUrl; }
});

test('invalid card identifiers never create a retailer link and resolver calls never alter catalog data', () => {
  for (const number of ['', null, undefined, 'not-a-card', 'hBP01-001<script>', 'hBP01-001&token=private', 'https://example.invalid', 'hBP01-01', 'hBP001-001']) {
    assert.equal(canonicalCardNumber(number), ''); assert.equal(yuyuteiCardLink(number, ''), null);
  }
  const before = JSON.stringify(productData), catalogBefore = JSON.stringify(catalog);
  for (const row of products) for (let i = 0; i < 3; i++) yuyuteiCardLink(row.cardNumber, row.officialImageUrl);
  assert.equal(JSON.stringify(productData), before); assert.equal(JSON.stringify(catalog), catalogBefore);
});
