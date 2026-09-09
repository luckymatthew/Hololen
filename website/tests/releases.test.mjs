import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseMetadata, APK_URL, PREVIEW_TAG, PREVIEW_URL } from '../lib/releases.mjs';
test('download always points at stable GitHub release asset', () => assert.equal(APK_URL, 'https://github.com/luckymatthew/Hololen/releases/latest/download/HoloLens.apk'));
test('extracts current version and APK size without trusting release URLs', () => { const meta = releaseMetadata({ tag_name: 'v1.2.3', published_at: '2026-09-09', assets: [{ name: 'HoloLens.apk', size: 1024 }], body: '<script>test</script>' }); assert.equal(meta.version, 'v1.2.3'); assert.equal(meta.size, 1024); });
test('missing or prerelease APK metadata cannot change stable link', () => { assert.throws(() => releaseMetadata({ assets: [] })); assert.throws(() => releaseMetadata({ prerelease: true, assets: [] })); assert.ok(APK_URL.endsWith('/HoloLens.apk')); });
test('only the explicitly verified preview is accepted as a fallback and remains labeled preview', () => { const payload = { tag_name: PREVIEW_TAG, prerelease: true, assets: [{ name: 'HoloLens.apk', size: 576750232 }] }; assert.equal(releaseMetadata(payload, true).preview, true); assert.throws(() => releaseMetadata({ ...payload, tag_name: 'unknown-preview' }, true)); assert.ok(PREVIEW_URL.includes(`/download/${PREVIEW_TAG}/`)); });
