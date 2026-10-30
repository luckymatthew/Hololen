// Test-only outer provenance layer for the selected-printing retailer links.
// No historical card, UI or APK baseline hashes are replaced by this layer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

export const yuyuteiProvenance = JSON.parse(fs.readFileSync(new URL('./fixtures/yuyutei-2026-10-30-runtime-changes.json', import.meta.url), 'utf8'));
const approved = ['website/app/page.tsx'];
const added = ['website/app/YuyuteiCardLink.tsx', 'website/lib/yuyutei-links.mjs', 'website/lib/yuyutei-card-products.json'];
assert.equal(yuyuteiProvenance.schemaVersion, 1);
assert.deepEqual(yuyuteiProvenance.approvedPaths, approved);
assert.deepEqual(yuyuteiProvenance.changes.map(change => change.path), approved);
assert.deepEqual(yuyuteiProvenance.approvedAddedPaths, added);
assert.deepEqual(yuyuteiProvenance.addedFiles.map(file => file.path), added);
assert.equal(yuyuteiProvenance.status, 'verified-source-update');
export const yuyuteiAddedPaths = yuyuteiProvenance.approvedAddedPaths;
const hash = value => createHash('sha256').update(value).digest('hex');

export function restoreYuyuteiBaseline(name, input) {
  const normalized = name.replace(/^.*?(?=website\/)/, '');
  const relative = normalized.startsWith('website/') ? normalized : `website/${name.replace(/^\.\//, '')}`;
  const change = yuyuteiProvenance.changes.find(item => item.path === relative);
  if (!change) return input;
  let contents = String(input);
  // The dedicated preservation test pins current bytes independently; accepting
  // already-restored input makes the historical provenance readers composable.
  if (hash(contents) === change.beforeSha256) return input;
  assert.equal(yuyuteiProvenance.status, 'verified-source-update', `${relative}: source review must be finalized`);
  assert.equal(hash(contents), change.afterSha256, `${relative}: exact reviewed Yuyutei source bytes`);
  for (const patch of [...change.patches].reverse()) {
    assert.ok(patch.after.length > 0, `${relative}: reversal cannot match empty text`);
    assert.equal(contents.split(patch.after).length - 1, 1, `${relative}: explicit unambiguous Yuyutei patch`);
    contents = contents.replace(patch.after, patch.before);
  }
  assert.equal(hash(contents), change.beforeSha256, `${relative}: restore exact deployed website bytes`);
  return Buffer.isBuffer(input) ? Buffer.from(contents) : contents;
}
