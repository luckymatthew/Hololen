import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readQuantity } from '../lib/deck-photo/quantity.mjs';
import digitTemplates from '../lib/deck-photo/digit-templates.mjs';

const { outputFiles } = await build({ entryPoints: ['lib/deck-photo/review.ts'], bundle: true, write: false, format: 'esm' });
const { makePhotoReview, photoChoices, reviewPhotoDeck } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`);

const card = { number: 'hBP02-026', name: '大神ミオ', group: 'holomem', stage: '1st', maxCopies: 4, simOnly: false, image: '/base.png' };
const base = { id: '26-base', image: '/base.png' };
const alternate = { id: '26-alt', image: '/alternate.png' };
const choices = photoChoices([base, alternate].map(variant => ({ id: variant.id, card, variant, label: variant.id, searchText: card.number })));
const rect = { x: 10, y: 20, width: 100, height: 140, section: 'main' };
const match = variant => ({ number: card.number, printingId: variant.id, source: variant.image, distance: 4 });
const finding = (variant, count, confidence) => ({ rect, matches: [match(variant)], count, confidence });
const exact = { card: true, printing: true };

test('recognizable same-card artwork defaults to the catalog printing and keeps a distinct verified parallel', () => {
  const rows = makePhotoReview({ layout: 'divided', rows: [finding(alternate, 2, { card: true, printing: false }), finding(alternate, 1, exact)] }, choices);
  assert.deepEqual(rows.map(row => [row.selected, row.defaulted]), [['hBP02-026/26-base', true], ['hBP02-026/26-alt', false]]);
  const result = reviewPhotoDeck(rows, choices);
  assert.deepEqual(result.deck.main, { 'hBP02-026': 3 });
  assert.deepEqual(result.deck.printings, { 'hBP02-026': { '26-base': 2, '26-alt': 1 } });
  assert.equal(result.canSave, true);
});

test('uncertain card numbers, unreadable quantities and stale artwork need a correction', () => {
  const rows = makePhotoReview({ layout: 'divided', rows: [
    finding(base, 4, { card: false, printing: false }), finding(base, null, exact),
    { ...finding(base, 1, exact), matches: [{ ...match(base), source: '/old.png' }] },
  ] }, choices);
  const result = reviewPhotoDeck(rows, choices);
  assert.equal(result.unresolved.size, 3);
  assert.equal(result.canSave, false);
  assert.deepEqual(result.deck.main, {});
});

test('single-copy cells are combined, and alternate printings share the card copy limit', () => {
  const rows = makePhotoReview({ layout: 'copies', rows: [finding(base, 1, exact), finding(base, 1, exact), finding(alternate, 3, exact)] }, choices);
  assert.deepEqual(rows.map(row => [row.count, row.rects.length]), [[2, 2], [3, 1]]);
  const result = reviewPhotoDeck(rows, choices);
  assert.equal(result.canSave, false);
  assert.match(result.problems[0], /hBP02-026 同卡號最多 4 張/);
});

test('OCR reads a two-digit Cheer badge and leaves a blank badge unresolved', () => {
  const width = 220, height = 250;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const image = { width, height, data };
  const cheer = { x: 20, y: 12, width: 156, height: 218, section: 'cheer', quantityMode: 'badge' };
  function set(x, y, level) {
    const offset = (y * width + x) * 4;
    data.fill(level, offset, offset + 3);
  }
  for (let y = 194; y < 229; y++) for (let x = 130; x < 177; x++) set(x, y, 0);
  assert.equal(readQuantity(image, cheer), null);
  let left = 135;
  for (const digit of ['1', '6']) {
    const [aspect, raster] = digitTemplates[digit][0];
    const glyphHeight = 25;
    const glyphWidth = Math.round(aspect * glyphHeight);
    for (let y = 0; y < glyphHeight; y++) for (let x = 0; x < glyphWidth; x++) {
      set(left + x, 199 + y, parseInt(raster[Math.floor(y * 18 / glyphHeight) * 12 + Math.floor(x * 12 / glyphWidth)], 16) * 17);
    }
    left += glyphWidth + 3;
  }
  assert.equal(readQuantity(image, cheer), 16);
});
