import { restorePreviewReleaseBaseline } from './preview-release-preservation-helpers.mjs';
import { restoreTranslationBaseline } from './translation-preservation-helpers.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { restoreYuyuteiBaseline, yuyuteiAddedPaths, yuyuteiProvenance } from './yuyutei-preservation-helpers.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const read = path => restorePreviewReleaseBaseline(path, restoreTranslationBaseline(path, readFileSync(new URL(`../../${path}`, import.meta.url))));

test('retailer feature changes exactly one existing runtime path and introduces only its three reviewed files', () => {
  assert.equal(yuyuteiProvenance.status, 'verified-source-update');
  assert.equal(yuyuteiProvenance.baselineSourceCommit, '61941e7e6d319a60cc304cfc8b6b45fa17169b51');
  assert.equal(yuyuteiProvenance.baselineTree, '98ad57cc1e6bbcac2f1061304a9430100e4164f9');
  assert.deepEqual(yuyuteiProvenance.approvedPaths, ['website/app/page.tsx']);
  assert.deepEqual(yuyuteiAddedPaths, ['website/app/YuyuteiCardLink.tsx', 'website/lib/yuyutei-links.mjs', 'website/lib/yuyutei-card-products.json']);
  assert.equal(yuyuteiProvenance.changes[0].beforeSha256, 'fa58cc43f15ee7d45ff840e9fdf8a8305a4015ae4781cab9d032e8149b76b77c');
  for (const change of yuyuteiProvenance.changes) {
    const current = read(change.path);
    assert.equal(hash(current), change.afterSha256, `${change.path}: current source must match the exact reviewed feature`);
    const restored = restoreYuyuteiBaseline(change.path, current);
    assert.equal(hash(restored), change.beforeSha256, `${change.path}: restore the deployed 1.2.8 website exactly`);
    assert.deepEqual(restoreYuyuteiBaseline(change.path, restored), restored, 'historical readers can compose without widening scope');
  }
  for (const added of yuyuteiProvenance.addedFiles) assert.equal(hash(read(added.path)), added.sha256, `${added.path}: exact reviewed addition`);
});

test('retailer feature keeps the catalog, illustrated log, APK download and historical fixtures unchanged', () => {
  const expected = {
    'website/public/cards.json': '75814dea892ac79fdf2ad9dd09987c117c870163b9e903b63533df22be2119ac',
    'website/public/website-updates.json': 'e1fda4a1ff6e5053972ae5e16ed1b9af3ebaf4f989e4c2ec0bca3e115b6ca0b9',
    'website/lib/releases.mjs': 'c5a0ae303ea1687e8c6b2d182d8849a94736719611db08ad665429a9e80ded8a',
    'website/app/download/DownloadClient.tsx': '9eec5217ad5841e5852290f440dbbc0a124a7830a796f9a0d0c59a14c574236f',
    'website/tests/fixtures/card-refresh-production-baseline.json': '8d769262c6db3db1977025f6812286b770fdca0dc1b1be5e96c4a13f3f7c2b0a',
    'website/tests/fixtures/card-refresh-2026-10-29-baseline.json': '58a2745ee13824ed4b80c49c20eeb85dbee4d19fdadfd8512b1032edb8e466f9',
    'website/tests/fixtures/card-refresh-2026-10-29-runtime-changes.json': '9ef71c8783fc397dd9d246812677e1d2458e62dfeaebafd70be91d35af2c0ffe',
    'website/tests/fixtures/ui-redesign-2026-10-29-runtime-changes.json': 'b461cba583920323f79cf5177dcecc8aeee7927217f7e360ad923c927a3f3b47',
    'website/tests/fixtures/apk-release-1.2.8-runtime-changes.json': '0d72062348123185fc3125f67d1aaf97e4edc8334021d0112c609952d12f96df',
  };
  assert.deepEqual(yuyuteiProvenance.unchangedFileSha256, expected, 'all nine protected hashes are independently pinned to deployed bytes');
  for (const [path, sha256] of Object.entries(yuyuteiProvenance.unchangedFileSha256)) assert.equal(hash(read(path)), sha256, `${path}: no catalog, download or historical-fixture rewrite`);
});

test('retailer restoration rejects additional edits and cannot modify unrelated runtime bytes', () => {
  for (const change of yuyuteiProvenance.changes) assert.throws(() => restoreYuyuteiBaseline(change.path, `${read(change.path)}\n// Unreviewed mutation`), /exact reviewed Yuyutei source bytes/);
  const untouched = Buffer.from('unchanged simulator bytes');
  assert.equal(restoreYuyuteiBaseline('website/lib/simulator/engine.mjs', untouched), untouched);
});
