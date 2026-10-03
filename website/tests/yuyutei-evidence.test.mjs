import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifiedYuyuteiProducts } from '../scripts/validate-yuyutei-evidence.mjs';
import { yuyuteiLink } from '../lib/yuyutei-links.mjs';

const catalog = JSON.parse(readFileSync('public/cards.json', 'utf8'));
const luna = catalog.cards.find(card => card.number === 'hBP03-001');
// Synthetic attestation for logic tests only; never written into the product manifest.
const fixture = {
  number: luna.number, rarity: 'OUR', url: 'https://yuyu-tei.jp/sell/hocg/card/hbp03/10002',
  title: 'OUR 姫森ルーナ(パラレル)', retailerImage: 'https://yuyu-tei.jp/synthetic-fixture.png',
  officialImage: luna.variants[1].image, method: 'primary-browser', artworkConfirmed: true,
  observedAt: '2026-10-03T12:00:00Z', reference: 'Synthetic test fixture; not source verification',
};
const product = record => verifiedYuyuteiProducts([record], catalog)[0];
const resolveProduct = p => yuyuteiLink(luna, luna.variants[1], new Map([[`${luna.number}|678`, p]]));

test('primary evidence derives the existing printing ID and enables only that exact artwork', () => {
  const p = product(fixture);
  assert.equal(p.printingId, '678');
  assert.equal(resolveProduct(p).kind, 'product');
  assert.equal(yuyuteiLink(luna, luna.variants[0], new Map([[`${luna.number}|678`, p]])).kind, 'search');
  assert.deepEqual(verifiedYuyuteiProducts([{ ...fixture, officialImage: undefined, printingId: '678' }], catalog), [p]);
  assert.deepEqual(verifiedYuyuteiProducts([], catalog), []);
});

test('batch validation rejects snippets, wrong artwork/rarity/ID, unsafe URLs and duplicate prices', () => {
  for (const change of [
    { method: 'indexed-snippet' }, { artworkConfirmed: false }, { officialImage: luna.variants[0].image },
    { rarity: 'OSR' }, { printingId: '565' }, { number: 'hPR-999' }, { reference: '' }, { observedAt: '' },
    { observedAt: '2026-10-03T12:00:00' },
    { url: 'https://yuyu-tei.jp/sell/hocg/card/hbp08/10002' },
    { title: 'OUR Different card' }, { title: '【傷】 OUR 姫森ルーナ' },
    { retailerImage: 'http://example.test/art.png' }, { retailerImage: 'https://user:password@example.test/art.png' },
    { url: fixture.url + '/damage' }, { url: fixture.url + '?printing=OSR' },
  ]) assert.throws(() => product({ ...fixture, ...change }));
  assert.throws(() => product({ ...fixture, officialImage: undefined, printingId: undefined }));
  assert.throws(() => verifiedYuyuteiProducts([fixture, fixture], catalog), /duplicate/);
  const osr = { ...fixture, rarity: 'OSR', title: 'OSR 姫森ルーナ', officialImage: luna.variants[0].image };
  assert.throws(() => verifiedYuyuteiProducts([fixture, osr], catalog), /reused retailer URL/);
});

test('runtime ignores incomplete, contradictory and merely indexed attestations', () => {
  const p = product(fixture);
  assert.equal(resolveProduct({ ...p, printingVerified: false }).kind, 'search');
  assert.equal(resolveProduct({ ...p, url: 10002 }).kind, 'search');
  assert.equal(resolveProduct({ ...p, evidence: undefined }).kind, 'search');
  assert.equal(resolveProduct({ ...p, officialImage: luna.variants[0].image }).kind, 'search');
  for (const change of [
    { method: 'indexed-snippet' }, { sourceUrl: fixture.url + '/damage' }, { number: 'hBP03-002' },
    { rarity: 'OSR' }, { officialImage: luna.variants[0].image }, { artworkConfirmed: false },
    { reference: '' }, { title: '' }, { retailerImage: '' }, { observedAt: 'not-a-date' },
    { observedAt: '2026-10-03T12:00:00' },
    { title: 'OSR 姫森ルーナ' },
  ]) assert.equal(resolveProduct({ ...p, evidence: { ...p.evidence, ...change } }).kind, 'search');
});

test('reprints need the exact edition artwork; repeated number/rarity never selects the first printing', () => {
  const card = catalog.cards.find(c => c.number === 'hBP01-028');
  const edition = card.variants.find(v => v.id === '2314');
  const record = { ...fixture, number: card.number, rarity: 'C', title: 'C IRyS(パラレル/hBP08)',
    url: 'https://yuyu-tei.jp/sell/hocg/card/hbp08/19999', officialImage: edition.image, retailerSet: 'hBP08', editionLabel: '(パラレル/hBP08)' };
  const p = product(record);
  assert.equal(p.printingId, '2314');
  assert.equal(p.evidence.editionLabel, '(パラレル/hBP08)');
  assert.throws(() => product({ ...record, officialImage: undefined, printingId: undefined }), /artwork|printingId/);
  const original = card.variants.find(v => v.rarity === 'C' && v.id !== '2314');
  assert.throws(() => product({ ...record, officialImage: original.image }), /edition/);
  const index = new Map([[`${card.number}|${edition.id}`, p]]);
  assert.equal(yuyuteiLink(card, edition, index).kind, 'product');
  assert.equal(yuyuteiLink(card, original, index).kind, 'search');
});

test('before/after errata needs a separately attested printed-text match', () => {
  const card = catalog.cards.find(c => c.number === 'hBP03-027'), v = card.variants.find(v => v.id === '591');
  const record = { ...fixture, number: card.number, rarity: 'C', title: 'C さくらみこ(エラッタ前)',
    officialImage: v.image, url: 'https://yuyu-tei.jp/sell/hocg/card/hbp03/10058' };
  assert.throws(() => product(record), /errata/);
  assert.throws(() => product({ ...record, errataConfirmed: true, errataVersion: 'after' }), /errata/);
  const p = product({ ...record, errataConfirmed: true, errataVersion: 'before' });
  const map = new Map([[`${card.number}|${v.id}`, p]]);
  assert.equal(yuyuteiLink(card, v, map).kind, 'product');
  p.evidence.errataConfirmed = false;
  assert.equal(yuyuteiLink(card, v, map).kind, 'search');
});
