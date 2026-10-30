import { restoreTranslationBaseline } from './translation-preservation-helpers.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { restoreUiBaseline, uiProvenance } from './ui-preservation-helpers.mjs';
import { restoreApkReleaseBaseline } from './apk-release-preservation-helpers.mjs';
import { restoreYuyuteiBaseline } from './yuyutei-preservation-helpers.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const read = path => restoreApkReleaseBaseline(path, restoreYuyuteiBaseline(path, restoreTranslationBaseline(path, readFileSync(new URL(`../../${path}`, import.meta.url)))));

test('redesign is exactly scoped over the verified card/footer checkpoint, without weakening historical runtime hashes', () => {
  assert.equal(uiProvenance.baselineSourceCommit, '211da7e605978c815dda47f4bf75b3e7c02f3408');
  assert.equal(uiProvenance.baselineTree, '43dbfac0ac2c682364996207a746cc1dce3cd313');
  assert.deepEqual(uiProvenance.changes.map(change => change.path).sort(), ['website/app/CardScanner.tsx','website/app/ConfirmDialog.tsx','website/app/WebsiteUpdateLog.tsx','website/app/account/FirebaseAccount.tsx','website/app/download/DownloadClient.tsx','website/app/layout.tsx','website/app/page.tsx','website/app/simulator/SimulatorClient.tsx','website/firebase/main.tsx'].sort());
  assert.deepEqual(uiProvenance.addedPaths.sort(), ['website/app/StudioHeader.tsx','website/app/design-system.css','website/app/motion.css','website/app/ui-motion.tsx'].sort());
  const production = JSON.parse(read('website/tests/fixtures/card-refresh-production-baseline.json'));
  const refresh = JSON.parse(read('website/tests/fixtures/card-refresh-2026-10-29-runtime-changes.json'));
  const approvedBefore = new Map([...Object.entries(production.protectedRuntime.fileSha256), ...refresh.changes.map(change => [change.path, change.afterSha256]), ...refresh.addedFiles.map(file => [file.path, file.sha256])]);
  for (const change of uiProvenance.changes) {
    assert.equal(change.beforeSha256, approvedBefore.get(change.path), `${change.path}: exact pre-redesign reviewed source hash, not a rewritten baseline`);
    const current = read(change.path); assert.equal(hash(current), change.afterSha256);
    assert.equal(hash(restoreUiBaseline(change.path, current)), change.beforeSha256);
  }
  for (const path of uiProvenance.addedPaths) assert.equal(hash(read(path)), uiProvenance.addedSha256[path]);
  assert.ok(!uiProvenance.changes.some(change => /\/lib\/|\/public\/cards\.json|rules|package|mobile\//.test(change.path)));
});
