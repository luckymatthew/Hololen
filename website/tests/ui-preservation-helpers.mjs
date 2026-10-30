import { restoreTranslationBaseline } from './translation-preservation-helpers.mjs';
// Test-only UI provenance layer. This cannot modify runtime data or user storage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { restoreApkReleaseBaseline } from './apk-release-preservation-helpers.mjs';
import { restoreYuyuteiBaseline } from './yuyutei-preservation-helpers.mjs';
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/ui-redesign-2026-10-29-runtime-changes.json', import.meta.url), 'utf8'));
export const uiAddedPaths = fixture.addedPaths;
export const uiChangedPaths = fixture.changes.map(change => change.path);
export const uiProvenance = fixture;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function restoreUiBaseline(name, input) {
  input = restoreTranslationBaseline(name, input);
  input = restoreYuyuteiBaseline(name, input);
  input = restoreApkReleaseBaseline(name, input);
  const normalized = name.replace(/^.*?(?=website\/)/, '');
  const relative = normalized.startsWith('website/') ? normalized : `website/${name.replace(/^\.\//, '')}`;
  const change = fixture.changes.find(item => item.path === relative);
  if (!change) return input;
  let contents = String(input);
  assert.equal(hash(contents), change.afterSha256, `${relative}: exact reviewed redesign bytes`);
  for (const patch of [...change.patches].reverse()) {
    assert.equal(contents.split(patch.after).length - 1, 1, `${relative}: explicit reversible UI patch`);
    contents = contents.replace(patch.after, patch.before);
  }
  assert.equal(hash(contents), change.beforeSha256, `${relative}: restore exact integrated card/footer checkpoint`);
  return Buffer.isBuffer(input) ? Buffer.from(contents) : contents;
}
