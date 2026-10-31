import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {FEATURED_METADATA,FEATURED_TAG,STABLE_METADATA,STABLE_APK_URL,featuredReleaseMetadata,apkUrl,installZipUrl} from '../lib/releases.mjs';
import {inferenceReleaseProvenance as proof,restoreInferenceReleaseBaseline as restore,previous136ReleaseModule} from './inference-release-preservation-helpers.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const read=name=>readFileSync(new URL('../../'+name,import.meta.url));
const verified=JSON.parse(readFileSync(new URL('./fixtures/verified-apk-1.3.7.json',import.meta.url),'utf8'));

test('1.3.7 changes only the two download paths from the exact deployed polish/printing/date baseline',()=>{
 assert.equal(proof.baselineSourceCommit,'bc691a81d7f2945def33dda1013d09022f41691d');assert.equal(proof.baselineTree,'97884776e9a3e957076adcdece1e2dd7221d329e');
 for(const change of proof.changes){const current=read(change.path);assert.equal(hash(current),change.afterSha256);const before=restore(change.path,current);assert.equal(hash(before),change.beforeSha256);assert.strictEqual(restore(change.path,before),before);assert.throws(()=>restore(change.path,Buffer.concat([current,Buffer.from('UNREVIEWED')])),/exact verified preview release bytes/);}
});

test('1.3.7 preserves historical fixtures, independent printings, shared deck limits, UI polish, Japan dates and data channel',()=>{
 for(const[name,expected]of Object.entries(proof.unchangedFileSha256))assert.equal(hash(read(name)),expected,name);
 const catalog=JSON.parse(read('website/public/cards.json'));assert.equal(catalog.displayTranslations.revision,'59a34c25c0e27077ac3f19dca87cc2f7a68248f098c743768678206b833328f7');
 const log=JSON.parse(read('website/public/website-updates.json'));assert.equal(log.entries[0].catalogSha256,'b879faeda2824affcb378e965010a13b1b50da4b473fb23819f6c6834385d3fa');
});

test('1.3.7 current metadata matches the verified assets and reports the exact remaining inference limits',()=>{
 const value=featuredReleaseMetadata(verified);assert.equal(FEATURED_TAG,'v1.3.7');assert.equal(value.version,'v1.3.7');assert.equal(value.size,628873695);assert.equal(value.sha256,'4dea8014963dbc36441fd872fbd77d62b206f25cefe025f5fc8cf4a507daaa17');assert.equal(value.installZipAvailable,true);
 assert.equal(apkUrl(value.version),'https://github.com/luckymatthew/Hololen/releases/download/v1.3.7/HoloLens.apk');assert.equal(installZipUrl(value.version),'https://github.com/luckymatthew/Hololen/releases/download/v1.3.7/Hololens-1.3.7-Install.zip');
 assert.match(FEATURED_METADATA.notes,/confirmed Android ICU/);assert.match(FEATURED_METADATA.notes,/not a claim of successful phone inference/);assert.match(FEATURED_METADATA.notes,/340\/347/);assert.match(FEATURED_METADATA.notes,/seven unchanged/);assert.match(FEATURED_METADATA.notes,/not all-green/);assert.match(FEATURED_METADATA.notes,/No live OAuth/);assert.match(FEATURED_METADATA.notes,/1\.4\.0 engine candidate is not included/);
});

test('previous 1.3.6 contract stays exact while current parser rejects it and retains stable rollback',async()=>{
 const previous=await previous136ReleaseModule();const old=JSON.parse(readFileSync(new URL('./fixtures/verified-apk-1.3.6.json',import.meta.url),'utf8'));
 assert.equal(previous.featuredReleaseMetadata(old).version,'v1.3.6');assert.throws(()=>featuredReleaseMetadata(old));assert.deepEqual(STABLE_METADATA,previous.STABLE_METADATA);assert.equal(STABLE_APK_URL,previous.STABLE_APK_URL);
});
