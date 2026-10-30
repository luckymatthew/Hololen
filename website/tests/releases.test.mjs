import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseMetadata, APK_URL, STABLE_APK_URL, STABLE_METADATA, apkUrl, installZipUrl } from '../lib/releases.mjs';
const digest = 'e608ddf50c6eb746e2023a87843e52ef1f01e9a1c6bf6390255f1cc8e16b0a08';
const apk = { name: 'HoloLens.apk', size: 615463775, state: 'uploaded', digest: `sha256:${digest}` };
const zip = { name: 'Hololens-1.2.8-Install.zip', size: 615465884, state: 'uploaded', digest: 'sha256:894c4acd0fa06956611dec841f34b3e2286570a1e98593c177070f21b87d8950' };
const payload = { tag_name: 'v1.2.8', published_at: '2026-10-29T18:39:19Z', assets: [apk, zip] };
test('offline default is the verified public versioned stable APK and real install ZIP', () => {
 assert.equal(STABLE_METADATA.preview, false);
 assert.equal(STABLE_METADATA.version, 'v1.2.8');
 assert.equal(STABLE_METADATA.size, 615463775);
 assert.equal(STABLE_METADATA.date, '2026-10-29T18:39:19Z');
 assert.equal(STABLE_METADATA.sha256, digest);
 assert.equal(STABLE_METADATA.installZipAvailable, true);
 assert.equal(STABLE_APK_URL, 'https://github.com/luckymatthew/Hololen/releases/download/v1.2.8/HoloLens.apk');
 assert.equal(APK_URL, 'https://github.com/luckymatthew/Hololen/releases/download/v1.3.3/HoloLens.apk');
 assert.equal(installZipUrl(STABLE_METADATA.version), 'https://github.com/luckymatthew/Hololen/releases/download/v1.2.8/Hololens-1.2.8-Install.zip');
});
test('pinned public metadata retains independently verified integrity even when the API omits a digest', () => {
 assert.equal(releaseMetadata(payload).sha256, digest);
 assert.equal(releaseMetadata(payload).installZipAvailable, true);
 assert.equal(releaseMetadata({ ...payload, assets: [{ ...apk, digest: null }] }).sha256, digest);
 assert.equal(releaseMetadata({ ...payload, assets: [apk] }).installZipAvailable, false);
 for (const changed of [{ ...apk, size: apk.size + 1 }, { ...apk, digest: `sha256:${'0'.repeat(64)}` }, { ...apk, digest: 'invalid' }]) assert.throws(() => releaseMetadata({ ...payload, assets: [changed] }), /已核實/);
});
test('new stable metadata and its actual optional downloads remain paired without reusing an old hash', () => {
 const futureApk = { ...apk, size: apk.size + 1, digest: `sha256:${'a'.repeat(64)}` };
 const futureZip = { ...zip, name: 'Hololens-1.2.9-Install.zip' };
 const meta = releaseMetadata({ ...payload, tag_name: 'v1.2.9', assets: [futureApk, futureZip] });
 assert.equal(meta.version, 'v1.2.9'); assert.equal(meta.sha256, 'a'.repeat(64)); assert.equal(meta.installZipAvailable, true);
 assert.ok(apkUrl(meta.version).includes('/download/v1.2.9/'));
 assert.equal(installZipUrl(meta.version), 'https://github.com/luckymatthew/Hololen/releases/download/v1.2.9/Hololens-1.2.9-Install.zip');
 assert.equal(releaseMetadata({ ...payload, tag_name: 'v1.3.0', assets: [{ ...futureApk, digest: null }] }).sha256, '');
 assert.equal(releaseMetadata({ ...payload, tag_name: 'v2.0.0', assets: [futureApk, zip] }).installZipAvailable, false);
});
test('ZIP links require actual uploaded nonempty correctly named assets and pinned integrity', () => {
 for (const changed of [{ ...zip, name: 'unverified.zip' }, { ...zip, state: 'new' }, { ...zip, size: 0 }, { ...zip, size: zip.size + 1 }, { ...zip, digest: `sha256:${'0'.repeat(64)}` }]) assert.equal(releaseMetadata({ ...payload, assets: [apk, changed] }).installZipAvailable, false);
});
test('preview, draft, old, malformed and incomplete releases cannot replace stable download', () => {
 const invalid = [{...payload, prerelease:true}, {...payload, draft:true}, ...['v0.7.2','v1.0.0','v1.1.0', ...Array.from({length:8}, (_,i) => `v1.2.${i}`), 'v1.2.8-beta', 'v01.2.9', 'v1.2.9007199254740992', 'not-a-version'].map(tag_name => ({...payload, tag_name})), {...payload, published_at:'invalid'}, {...payload, published_at:null}, {...payload, assets:[]}, {...payload, assets:[{name:'HoloLens.apk',state:'new',size:1}]}, ...[0,-1,1.5,Infinity,Number.MAX_SAFE_INTEGER+1].map(size => ({...payload, assets:[{...apk,size}]}))];
 for (const value of invalid) assert.throws(() => releaseMetadata(value));
});
