// Test-only outer proof for two stylesheet imports; historical fixtures stay frozen.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

export const polishProvenance = JSON.parse(fs.readFileSync(new URL('./fixtures/ui-polish-2026-10-31-runtime-changes.json', import.meta.url), 'utf8'));
const approved = ['website/app/layout.tsx', 'website/firebase/main.tsx'];
assert.equal(polishProvenance.schemaVersion, 1);
assert.equal(polishProvenance.baselineSourceCommit, '9cfbeaa78252b9fdd479ad461db605348f07b24a');
assert.deepEqual(polishProvenance.approvedPaths, approved);
assert.deepEqual(polishProvenance.changes.map(change => change.path), approved);
assert.deepEqual(polishProvenance.approvedAddedPaths, ['website/app/polish.css']);
export const polishAddedPaths = polishProvenance.approvedAddedPaths;
const hash = value => createHash('sha256').update(value).digest('hex');

export function restorePolishBaseline(name, input) {
  const normalized = name.replaceAll('\\', '/');
  const relative = normalized.includes('website/') ? normalized.slice(normalized.indexOf('website/')) : `website/${normalized.replace(/^\.\//, '')}`;
  const change = polishProvenance.changes.find(item => item.path === relative);
  if (!change) return input;
  let contents = String(input);
  // Composition may supply already-restored bytes. The dedicated test separately
  // requires current source to match afterSha256, so a missing import cannot pass.
  if (hash(contents) === change.beforeSha256) return input;
  assert.equal(hash(contents), change.afterSha256, `${relative}: exact reviewed polish import bytes`);
  for (const patch of [...change.patches].reverse()) {
    assert.ok(patch.after.length > 0, `${relative}: reversal cannot match empty text`);
    assert.equal(contents.split(patch.after).length - 1, 1, `${relative}: unique polish import reversal`);
    contents = contents.replace(patch.after, patch.before);
  }
  assert.equal(hash(contents), change.beforeSha256, `${relative}: restore exact pre-polish source bytes`);
  return Buffer.isBuffer(input) ? Buffer.from(contents) : contents;
}
