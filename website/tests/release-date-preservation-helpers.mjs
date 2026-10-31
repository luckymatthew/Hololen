// Test-only date-presentation proof. Prior printing/UI fixtures remain immutable.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

export const releaseDateProvenance = JSON.parse(fs.readFileSync(new URL('./fixtures/release-date-presentation-2026-10-31-runtime-changes.json', import.meta.url), 'utf8'));
const approved = ['website/app/page.tsx', 'website/app/simulator/SimulatorClient.tsx'];
const added = ['website/lib/card-release-status.mjs', 'website/app/useJapanDate.ts'];
assert.equal(releaseDateProvenance.schemaVersion, 1);
assert.equal(releaseDateProvenance.status, 'verified-release-date-presentation');
assert.equal(releaseDateProvenance.baselineSourceCommit, '554fc0cc444cd7b23af5a672e169d3a5bbfd9584');
assert.deepEqual(releaseDateProvenance.approvedPaths, approved);
assert.deepEqual(releaseDateProvenance.changes.map(change => change.path), approved);
assert.deepEqual(releaseDateProvenance.approvedAddedPaths, added);
assert.deepEqual(releaseDateProvenance.addedFiles.map(file => file.path), added);
export const releaseDateAddedPaths = releaseDateProvenance.approvedAddedPaths;
const hash = value => createHash('sha256').update(value).digest('hex');

export function restoreReleaseDateBaseline(name, input) {
  const normalized = name.replaceAll('\\', '/');
  const relative = normalized.includes('website/') ? normalized.slice(normalized.indexOf('website/')) : `website/${normalized.replace(/^\.\//, '')}`;
  const change = releaseDateProvenance.changes.find(item => item.path === relative);
  if (!change) return input;
  let contents = String(input);
  // The dedicated current-source proof independently requires the new after hash.
  if (hash(contents) === change.beforeSha256) return input;
  assert.equal(hash(contents), change.afterSha256, `${relative}: exact reviewed release date presentation bytes`);
  for (const patch of [...change.patches].reverse()) {
    assert.ok(patch.after.length > 0, `${relative}: date reversal cannot match empty text`);
    assert.equal(contents.split(patch.after).length - 1, 1, `${relative}: unique date presentation reversal`);
    contents = contents.replace(patch.after, patch.before);
  }
  assert.equal(hash(contents), change.beforeSha256, `${relative}: restore exact approved pre-date source`);
  return Buffer.isBuffer(input) ? Buffer.from(contents) : contents;
}
