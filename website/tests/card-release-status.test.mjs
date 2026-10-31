import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { japanDateAt, printingReleaseStatus, isCalendarDate, msUntilNextJapanDate } from '../lib/card-release-status.mjs';

const officialPreview = (releaseDate = '2026-10-30') => ({ officialImportSchema: 2, preview: true, releaseDate });

function assertFlags(status, officialPreview, preview, released) {
  assert.equal(status.officialPreview, officialPreview);
  assert.equal(status.preview, preview);
  assert.equal(status.released, released);
}

test('Japan calendar day changes at UTC 15:00, including month, year and leap-day boundaries', () => {
  assert.equal(japanDateAt(Date.parse('2026-10-29T14:59:59.999Z')), '2026-10-29');
  assert.equal(japanDateAt(Date.parse('2026-10-29T15:00:00.000Z')), '2026-10-30');
  assert.equal(japanDateAt(Date.parse('2026-10-30T14:59:59.999Z')), '2026-10-30');
  assert.equal(japanDateAt(Date.parse('2026-10-30T15:00:00.000Z')), '2026-10-31');
  assert.equal(japanDateAt(Date.parse('2026-12-31T15:00:00.000Z')), '2027-01-01');
  assert.equal(japanDateAt(Date.parse('2028-02-28T15:00:00.000Z')), '2028-02-29');
  assert.equal(japanDateAt(Date.parse('2028-02-29T15:00:00.000Z')), '2028-03-01');
});

test('default Japan date reads the current clock and invalid timestamps have no date', () => {
  const originalNow = Date.now;
  try {
    Date.now = () => Date.parse('2026-10-30T15:00:00.000Z');
    assert.equal(japanDateAt(), '2026-10-31');
  } finally { Date.now = originalNow; }
  assert.equal(japanDateAt(new Date('2026-10-30T15:00:00.000Z')), '2026-10-31');
  for (const timestamp of [NaN, Infinity, -Infinity, null, {}, new Date(NaN), '2026-10-30T15:00:00Z', 'not-a-date']) assert.equal(japanDateAt(timestamp), '', `invalid timestamp ${String(timestamp)}`);
});

test('official prerelease presentation ends on its Japanese release date and remains ended afterward', () => {
  const card = officialPreview();
  for (const [day, pending] of [['2026-10-29', true], ['2026-10-30', false], ['2026-10-31', false]]) {
    const status = printingReleaseStatus(card, undefined, day);
    assertFlags(status, pending, pending, !pending);
    assert.equal(status.releaseDate, '2026-10-30');
  }
  const withoutPreview = printingReleaseStatus({ ...card, preview: false }, undefined, '2026-10-29');
  assertFlags(withoutPreview, false, false, false);
});

test('unparseable or missing release/current days conservatively retain official prerelease flags', () => {
  for (const releaseDate of [undefined, '', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-10-00', '2026-10-32', '2026-1-30', '2026-10-30T00:00:00Z', 'not-a-date']) {
    assertFlags(printingReleaseStatus({ ...officialPreview(), releaseDate }, undefined, '2026-10-31'), true, true, false);
  }
  for (const day of [null, '', '2026-02-29', '2026-04-31', '2026-13-01', '2026-10-00', '2026-10-32', '2026-1-30', '2026-10-31T00:00:00Z', 'not-a-date']) {
    assertFlags(printingReleaseStatus(officialPreview(), undefined, day), true, true, false);
  }
  assertFlags(printingReleaseStatus(officialPreview('2028-02-29'), undefined, '2028-02-29'), false, false, true);
});

test('a selected printing uses its own preview, official-import and release metadata without parent or sibling bleed', () => {
  const sibling = { id: 'future-sibling', ...officialPreview('2026-12-01') };
  const regular = { id: 'released-regular', officialImportSchema: 2, preview: false, releaseDate: '2020-01-01' };
  const card = { ...officialPreview('2026-10-30'), variants: [regular, sibling] };
  const before = JSON.stringify(card);
  const regularStatus = printingReleaseStatus(card, regular, '2026-10-31');
  assertFlags(regularStatus, false, false, true);
  assert.equal(regularStatus.releaseDate, regular.releaseDate);
  assertFlags(printingReleaseStatus(card, sibling, '2026-10-31'), true, true, false);
  const unknown = printingReleaseStatus(card, { id: 'metadata-not-known' }, '2026-10-31');
  assert.equal(unknown.officialPreview, false);
  assert.equal(unknown.preview, false);
  assert.equal(unknown.released, false);
  assert.equal(unknown.releaseDate, '');
  const legacyPreview = printingReleaseStatus(card, { id: 'simulator-preview', preview: true, releaseDate: '2020-01-01' }, '2026-10-31');
  assert.equal(legacyPreview.officialPreview, false, 'a parent official-import marker cannot classify another printing');
  assert.equal(legacyPreview.preview, true, 'nonofficial HoloSim preview presentation is unchanged');
  assert.equal(JSON.stringify(card), before);
});

test('nonofficial HoloSim preview stays preview after its date while future official preview remains pending', () => {
  const simCard = { preview: true, releaseDate: '2020-01-01' };
  for (const day of ['2019-12-31', '2020-01-01', '2026-10-31']) {
    const status = printingReleaseStatus(simCard, undefined, day);
    assert.equal(status.officialPreview, false);
    assert.equal(status.preview, true);
  }
  assertFlags(printingReleaseStatus(officialPreview('2026-12-01'), undefined, '2026-10-31'), true, true, false);
});

test('all real October 30 official printings are released by October 31 without changing catalog metadata', () => {
  const catalog = JSON.parse(readFileSync('public/cards.json', 'utf8'));
  const before = JSON.stringify(catalog);
  const selected = catalog.cards.flatMap(card => card.variants.filter(variant => variant.officialImportSchema === 2 && variant.preview && variant.releaseDate === '2026-10-30').map(variant => ({ card, variant })));
  assert.ok(selected.length > 1);
  for (const { card, variant } of selected) {
    const future = printingReleaseStatus(card, variant, '2026-10-29');
    assertFlags(future, true, true, false);
    for (const date of ['2026-10-30', '2026-10-31']) {
      const status = printingReleaseStatus(card, variant, date);
      assertFlags(status, false, false, true);
      assert.equal(status.releaseDate, '2026-10-30');
    }
  }
  assert.equal(JSON.stringify(catalog), before);
});


test('calendar-day validation rejects normalization, partial dates and year zero while accepting real leap days', () => {
  for (const day of ['0001-01-01', '2000-02-29', '2028-02-29', '9999-12-31']) assert.equal(isCalendarDate(day), true, day);
  for (const day of [undefined, null, 20261030, '', '0000-01-01', '10000-01-01', '1900-02-29', '2100-02-29', '2026-02-29', '2026-04-31', '2026-1-30', ' 2026-10-30', '2026-10-30 ', '2026-10-30T00:00:00Z']) assert.equal(isCalendarDate(day), false, String(day));
});

test('next Japan day delay schedules the exact UTC 15:00 boundary and never zero-delay loops', () => {
  assert.equal(msUntilNextJapanDate(Date.parse('2026-10-29T14:59:59.999Z')), 1);
  assert.equal(msUntilNextJapanDate(Date.parse('2026-10-29T15:00:00.000Z')), 86_400_000);
  assert.equal(msUntilNextJapanDate(Date.parse('2026-10-29T15:00:00.001Z')), 86_399_999);
  assert.equal(msUntilNextJapanDate(Date.parse('2026-10-30T00:00:00.000Z')), 54_000_000);
  assert.equal(msUntilNextJapanDate(Date.parse('2026-12-31T14:59:59.999Z')), 1);
  assert.equal(msUntilNextJapanDate(new Date('2026-10-29T14:59:59.999Z')), 1);
  for (const timestamp of [NaN, Infinity, -Infinity, null, {}, new Date(NaN), '2026-10-30T15:00:00Z']) assert.equal(msUntilNextJapanDate(timestamp), null, `invalid timestamp ${String(timestamp)}`);
});
