import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseMetadata, APK_URL, STABLE_METADATA, apkUrl, installZipUrl } from '../lib/releases.mjs';
const payload = { tag_name: 'v1.2.5', assets: [{ name: 'HoloLens.apk', size: 606583989, state: 'uploaded' }] };
test('offline default is the public versioned stable APK', () => {
 assert.equal(STABLE_METADATA.preview, false);
 assert.equal(STABLE_METADATA.version, 'v1.2.5');
 assert.equal(STABLE_METADATA.size, 606583989);
 assert.equal(APK_URL, 'https://github.com/luckymatthew/Hololen/releases/download/v1.2.5/HoloLens.apk');
 assert.equal(installZipUrl(STABLE_METADATA.version), 'https://github.com/luckymatthew/Hololen/releases/download/v1.2.5/Hololens-1.2.5-Install.zip');
});
test('new stable metadata and its download remain paired', () => {
 const meta = releaseMetadata({ ...payload, tag_name: 'v1.2.6' });
 assert.equal(meta.version, 'v1.2.6');
 assert.ok(apkUrl(meta.version).includes('/download/v1.2.6/'));
 assert.equal(installZipUrl(meta.version), 'https://github.com/luckymatthew/Hololen/releases/download/v1.2.6/Hololens-1.2.6-Install.zip');
});
test('preview, draft, old and incomplete releases cannot replace stable download', () => {
 for (const value of [{...payload, prerelease:true}, {...payload, draft:true}, {...payload, tag_name:'v0.7.2'}, {...payload, tag_name:'v1.0.0'}, {...payload, tag_name:'v1.1.0'}, {...payload, tag_name:'v1.2.0'}, {...payload, tag_name:'v1.2.1'}, {...payload, tag_name:'v1.2.2'}, {...payload, tag_name:'v1.2.3'}, {...payload, tag_name:'v1.2.4'}, {...payload, tag_name:'v1.2.5-beta'}, {...payload, assets:[]}, {...payload, assets:[{name:'HoloLens.apk',state:'new',size:1}]}]) assert.throws(() => releaseMetadata(value));
});
