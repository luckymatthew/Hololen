// Test-only outer proof; this layer never modifies application data or historical fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

export const printingProvenance = JSON.parse(fs.readFileSync(new URL('./fixtures/printing-catalog-2026-10-31-runtime-changes.json', import.meta.url), 'utf8'));
const approved = ['website/app/page.tsx'];
const added = ['website/lib/printing-catalog.mjs'];
assert.equal(printingProvenance.schemaVersion, 1);
assert.equal(printingProvenance.status, 'verified-printing-catalog-update');
assert.equal(printingProvenance.baselineSourceCommit, 'cdd4021a7dc4693260b401f834ecff6622359666');
assert.deepEqual(printingProvenance.approvedPaths, approved);
assert.deepEqual(printingProvenance.changes.map(change => change.path), approved);
assert.deepEqual(printingProvenance.approvedAddedPaths, added);
assert.deepEqual(printingProvenance.addedFiles.map(file => file.path), added);
export const printingAddedPaths = printingProvenance.approvedAddedPaths;
const hash = value => createHash('sha256').update(value).digest('hex');

export function restorePrintingBaseline(name, input) {
  const normalized = name.replaceAll('\\', '/');
  const relative = normalized.includes('website/') ? normalized.slice(normalized.indexOf('website/')) : `website/${normalized.replace(/^\.\//, '')}`;
  const change = printingProvenance.changes.find(item => item.path === relative);
  if (!change) return input;
  let contents = String(input);
  // A separate current-source test requires afterSha256. This exact old digest
  // permits repeated composition without accepting missing current changes.
  if (hash(contents) === change.beforeSha256) return input;
  assert.equal(hash(contents), change.afterSha256, `${relative}: exact reviewed printing catalog bytes`);
  for (const patch of [...change.patches].reverse()) {
    assert.ok(patch.after.length > 0, `${relative}: reversal cannot match empty text`);
    assert.equal(contents.split(patch.after).length - 1, 1, `${relative}: unique printing presentation reversal`);
    contents = contents.replace(patch.after, patch.before);
  }
  assert.equal(hash(contents), change.beforeSha256, `${relative}: restore exact merged pre-printing source`);
  return Buffer.isBuffer(input) ? Buffer.from(contents) : contents;
}
