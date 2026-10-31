import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { printingAddedPaths, printingProvenance, restorePrintingBaseline } from './printing-catalog-preservation-helpers.mjs';
import { restoreTranslationBaseline } from './translation-preservation-helpers.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url));
const page = 'website/app/page.tsx';
const beforeHash = '45f8a891800e98ac1be3b296e85f70e27d8e44043f6de445c9d1bd55e30bad6d';
const afterHash = 'f44f4d92fb1c74e2c1b83b8c925de04ce3901e1e75626dc11651ec8018ad3665';
const helperHash = 'e6f14c88ae299b32aedb642b6854bbe41cc6fa4bd56c338d8f2bce3d42fec2b3';
const catalogHash = 'b879faeda2824affcb378e965010a13b1b50da4b473fb23819f6c6834385d3fa';

test('printing presentation has one exact reversible page patch set and one pinned new helper', () => {
  assert.equal(printingProvenance.baselineSourceCommit, 'cdd4021a7dc4693260b401f834ecff6622359666');
  assert.deepEqual(printingProvenance.approvedPaths, [page]);
  assert.deepEqual(printingAddedPaths, ['website/lib/printing-catalog.mjs']);
  assert.deepEqual(printingProvenance.addedFiles, [{ path: printingAddedPaths[0], sha256: helperHash }]);
  assert.equal(hash(read(printingAddedPaths[0])), helperHash);
  const [change] = printingProvenance.changes;
  assert.equal(change.beforeSha256, beforeHash);
  assert.equal(change.afterSha256, afterHash);
  assert.ok(change.patches.length > 0);
  for (const patch of change.patches) {
    assert.ok(patch.before.length > 0 && patch.after.length > 0);
    assert.notEqual(patch.before, patch.after);
  }
  const current = read(page);
  assert.equal(hash(current), afterHash, 'actual current source must contain the whole reviewed printing update');
  const restored = restorePrintingBaseline(page, current);
  assert.ok(Buffer.isBuffer(restored));
  assert.equal(hash(restored), beforeHash, 'restore original merged source without rewriting its baseline');
});

test('printing normalization composes with frozen translation and retailer checkpoints', () => {
  const current = read(page), before = restorePrintingBaseline(page, current);
  assert.strictEqual(restorePrintingBaseline(page, before), before);
  assert.equal(restorePrintingBaseline('./app/page.tsx', String(current)), String(before));
  assert.deepEqual(restorePrintingBaseline('C:\\workspace\\website\\app\\page.tsx', current), before);
  assert.deepEqual(restoreTranslationBaseline(page, current), restoreTranslationBaseline(page, before));
  const historicalTranslation = restoreTranslationBaseline(page, current);
  assert.deepEqual(restoreTranslationBaseline(page, historicalTranslation), historicalTranslation);
  for (const path of ['website/public/cards.json', 'website/lib/simulator/engine.mjs', 'website/lib/firebase/store.ts', 'website/firestore.rules']) {
    const unrelated = Buffer.from('unreviewed bytes');
    assert.strictEqual(restorePrintingBaseline(path, unrelated), unrelated, `${path}: leave bytes for their original guards`);
  }
});

test('additional page changes and missing printing patches cannot pass the new proof', () => {
  const current = String(read(page));
  assert.throws(() => restorePrintingBaseline(page, current + '\nvoid 0;\n'), /exact reviewed printing catalog bytes/);
  assert.throws(() => restorePrintingBaseline(page, current.replaceAll('\n', '\r\n')), /exact reviewed printing catalog bytes/);
  for (const patch of printingProvenance.changes[0].patches) {
    assert.throws(() => restorePrintingBaseline(page, current.replace(patch.after, patch.before)), /exact reviewed printing catalog bytes/);
    assert.throws(() => restorePrintingBaseline(page, current.replace(patch.after, patch.after + patch.after)), /exact reviewed printing catalog bytes/);
  }
});

test('all canonical catalog and printing bytes stay unchanged at1416cards and3038artworks', () => {
  assert.deepEqual(printingProvenance.unchangedFileSha256, { 'website/public/cards.json': catalogHash });
  const bytes = read('website/public/cards.json');
  assert.equal(hash(bytes), catalogHash);
  const catalog = JSON.parse(bytes), variants = catalog.cards.flatMap(card => card.variants);
  assert.equal(catalog.cards.length, 1416);
  assert.equal(variants.length, 3038);
  assert.equal(new Set(catalog.cards.map(card => card.id)).size, 1416);
  assert.equal(new Set(variants.map(variant => variant.id)).size, 3038);
});
