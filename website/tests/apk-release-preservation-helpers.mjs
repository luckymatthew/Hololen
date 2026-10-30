import { restorePreviewReleaseBaseline } from './preview-release-preservation-helpers.mjs';
// Test-only outer provenance layer for the explicitly authorized APK-link update.
// Historical card/UI hashes remain unchanged and are checked after this reversal.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

export const apkReleaseProvenance = JSON.parse(fs.readFileSync(new URL('./fixtures/apk-release-1.2.8-runtime-changes.json', import.meta.url), 'utf8'));
const approved = ['website/lib/releases.mjs', 'website/app/download/DownloadClient.tsx'];
assert.equal(apkReleaseProvenance.schemaVersion, 1);
assert.deepEqual(apkReleaseProvenance.approvedPaths, approved);
assert.deepEqual(apkReleaseProvenance.changes.map(change => change.path), approved);
assert.equal(apkReleaseProvenance.status, 'verified-source-update');
const hash = value => createHash('sha256').update(value).digest('hex');

export function restoreApkReleaseBaseline(name, input) {
  const normalized = name.replace(/^.*?(?=website\/)/, '');
  const relative = normalized.startsWith('website/') ? normalized : `website/${name.replace(/^\.\//, '')}`;
  const change = apkReleaseProvenance.changes.find(item => item.path === relative);
  if (!change) return input;
  let contents = String(input);
  // Composition can receive bytes already reversed by the outer reader.
  // The dedicated preservation test separately pins current bytes to afterSha256.
  if (hash(contents) === change.beforeSha256) return input;
  input = restorePreviewReleaseBaseline(name, input);
  contents = String(input);
  assert.equal(hash(contents), change.afterSha256, `${relative}: exact approved APK-update bytes`);
  for (const patch of [...change.patches].reverse()) {
    assert.ok(patch.after.length > 0, `${relative}: reversal cannot match an empty string`);
    assert.equal(contents.split(patch.after).length - 1, 1, `${relative}: explicit unambiguous APK-update patch`);
    contents = contents.replace(patch.after, patch.before);
  }
  assert.equal(hash(contents), change.beforeSha256, `${relative}: restore exact deployed website bytes`);
  return Buffer.isBuffer(input) ? Buffer.from(contents) : contents;
}
