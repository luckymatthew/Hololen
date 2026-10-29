import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { apkReleaseProvenance, restoreApkReleaseBaseline } from './apk-release-preservation-helpers.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url));

test('APK download update has exactly two reversible source paths over the deployed baseline', () => {
  assert.equal(apkReleaseProvenance.baselineSourceCommit, '6082c46f4bff1209b60037359582693c9d8e02d3');
  assert.equal(apkReleaseProvenance.baselineTree, 'f4fbffead7ea5016bb4e5634492f8c23bdde01ac');
  assert.deepEqual(apkReleaseProvenance.approvedPaths, ['website/lib/releases.mjs', 'website/app/download/DownloadClient.tsx']);
  assert.equal(apkReleaseProvenance.changes[0].beforeSha256, '6d944155fcbeac950d9716af579832163998b917786f5a1acce787d676e040cc');
  assert.equal(apkReleaseProvenance.changes[1].beforeSha256, '7cb3842c357746a6f99bfcf96c0968f982ed9a5908f6f9d8126e5006ff7a2e5b');
  for (const change of apkReleaseProvenance.changes) {
    const current = read(change.path);
    assert.equal(hash(current), change.afterSha256, `${change.path}: current update must be exactly reviewed`);
    const previous = restoreApkReleaseBaseline(change.path, current);
    assert.equal(hash(previous), change.beforeSha256, `${change.path}: historical baseline must not be rewritten`);
    assert.deepEqual(restoreApkReleaseBaseline(change.path, previous), previous, 'outer restoration composes idempotently with UI restoration');
  }
});

test('APK update restoration rejects unrelated edits instead of widening protected runtime scope', () => {
  for (const change of apkReleaseProvenance.changes) {
    assert.throws(() => restoreApkReleaseBaseline(change.path, `${read(change.path)}\n// Unreviewed change`), /exact approved APK-update bytes/);
  }
  const untouched = Buffer.from('untouched engine bytes');
  assert.equal(restoreApkReleaseBaseline('website/lib/simulator/engine.mjs', untouched), untouched);
});
