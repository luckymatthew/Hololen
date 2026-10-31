import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { releaseDateAddedPaths, releaseDateProvenance, restoreReleaseDateBaseline } from './release-date-preservation-helpers.mjs';
import { restorePrintingBaseline } from './printing-catalog-preservation-helpers.mjs';
import { restoreTranslationBaseline } from './translation-preservation-helpers.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url));
const expectedChanges = [
  {
    "path": "website/app/page.tsx",
    "beforeSha256": "f44f4d92fb1c74e2c1b83b8c925de04ce3901e1e75626dc11651ec8018ad3665",
    "afterSha256": "d3b3c13b9f78703e2297bc49eee6be1a3a7ad38ed535050edbd6e1dea46e1c09"
  },
  {
    "path": "website/app/simulator/SimulatorClient.tsx",
    "beforeSha256": "3980596871f60ae89de4ad89ea21baf4cbda5aca176b22d0a89293124c952d20",
    "afterSha256": "a042e6ebc2f0fbe96f62362a69a84c6d1f3edafd57b0ab66c050c464c0c9ebfd"
  }
];
const expectedAdded = [
  {
    "path": "website/lib/card-release-status.mjs",
    "sha256": "27b5c53ef3b4f416a99e2060e706f5234319d849d653fa2563071f11a3d070df"
  },
  {
    "path": "website/app/useJapanDate.ts",
    "sha256": "8fea0bd21b5d0f58eaed09f3d46c5007db876cc5234729791c2bc36a7e53d74f"
  }
];
const unchanged = {
  "website/public/cards.json": "b879faeda2824affcb378e965010a13b1b50da4b473fb23819f6c6834385d3fa",
  "website/lib/printing-catalog.mjs": "e6f14c88ae299b32aedb642b6854bbe41cc6fa4bd56c338d8f2bce3d42fec2b3",
  "website/tests/fixtures/printing-catalog-2026-10-31-runtime-changes.json": "72eb21025ed5ee09b27a7be2cbad57f38d7d8af38a87ed2f5198dc3ea809c637",
  "website/tests/fixtures/ui-polish-2026-10-31-runtime-changes.json": "bed7599b950a41e65d2ac9f0193d37e0b3ae65d8d02c8a5b46ff069856cc9f4d"
};

test('release-date presentation pins exactly two UI patches and two new date files', () => {
  assert.equal(releaseDateProvenance.baselineSourceCommit, '554fc0cc444cd7b23af5a672e169d3a5bbfd9584');
  assert.deepEqual(releaseDateProvenance.approvedPaths, expectedChanges.map(change => change.path));
  assert.deepEqual(releaseDateAddedPaths, expectedAdded.map(file => file.path));
  assert.deepEqual(releaseDateProvenance.addedFiles, expectedAdded);
  for (const file of expectedAdded) assert.equal(hash(read(file.path)), file.sha256);
  for (const [index, expected] of expectedChanges.entries()) {
    const change = releaseDateProvenance.changes[index];
    assert.equal(change.path, expected.path);
    assert.equal(change.beforeSha256, expected.beforeSha256);
    assert.equal(change.afterSha256, expected.afterSha256);
    assert.ok(change.patches.length > 0);
    for (const patch of change.patches) {
      assert.ok(patch.before.length > 0 && patch.after.length > 0);
      assert.notEqual(patch.before, patch.after);
    }
    const current = read(change.path);
    assert.equal(hash(current), expected.afterSha256, 'raw current UI must contain the complete reviewed date update');
    const restored = restoreReleaseDateBaseline(change.path, current);
    assert.ok(Buffer.isBuffer(restored));
    assert.equal(hash(restored), expected.beforeSha256, 'restore exact approved554 source without replacing earlier hashes');
  }
});

test('date reversal preserves printing and older presentation checkpoint composition', () => {
  for (const change of expectedChanges) {
    const current = read(change.path), before = restoreReleaseDateBaseline(change.path, current);
    assert.strictEqual(restoreReleaseDateBaseline(change.path, before), before);
    assert.equal(restoreReleaseDateBaseline(change.path, String(current)), String(before));
    assert.deepEqual(restoreReleaseDateBaseline(`C:\\workspace\\${change.path.replaceAll('/', '\\')}`, current), before);
    assert.deepEqual(restorePrintingBaseline(change.path, current), restorePrintingBaseline(change.path, before));
    assert.deepEqual(restoreTranslationBaseline(change.path, current), restoreTranslationBaseline(change.path, before));
  }
  for (const path of ['website/public/cards.json', 'website/lib/printing-catalog.mjs', 'website/lib/simulator/engine.mjs', 'website/lib/firebase/store.ts', 'website/firestore.rules']) {
    const bytes = Buffer.from('unreviewed runtime change');
    assert.strictEqual(restoreReleaseDateBaseline(path, bytes), bytes, `${path}: retain original guard responsibility`);
  }
});

test('date proof rejects additional UI bytes, missing patches and duplicate patches', () => {
  for (const change of expectedChanges) {
    const current = String(read(change.path));
    assert.throws(() => restoreReleaseDateBaseline(change.path, current + '\nvoid 0;\n'), /exact reviewed release date presentation bytes/);
    assert.throws(() => restoreReleaseDateBaseline(change.path, current.replaceAll('\n', '\r\n')), /exact reviewed release date presentation bytes/);
    for (const patch of releaseDateProvenance.changes.find(item => item.path === change.path).patches) {
      assert.throws(() => restoreReleaseDateBaseline(change.path, current.replace(patch.after, patch.before)), /exact reviewed release date presentation bytes/);
      assert.throws(() => restoreReleaseDateBaseline(change.path, current.replace(patch.after, patch.after + patch.after)), /exact reviewed release date presentation bytes/);
    }
  }
});

test('date labels never rewrite catalog bytes or the approved printing/UI proof fixtures', () => {
  assert.deepEqual(releaseDateProvenance.unchangedFileSha256, unchanged);
  for (const [path, expected] of Object.entries(unchanged)) assert.equal(hash(read(path)), expected, `${path}: exact approved554 bytes remain frozen`);
  const catalog = JSON.parse(read('website/public/cards.json'));
  assert.equal(catalog.cards.length, 1416);
  assert.equal(catalog.cards.reduce((sum, card) => sum + card.variants.length, 0), 3038);
});
