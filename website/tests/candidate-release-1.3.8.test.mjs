import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {previous138ReleaseModule,restoreChoiceReleaseBaseline} from './choice-release-preservation-helpers.mjs';
const {FEATURED_METADATA,FEATURED_TAG,STABLE_METADATA,STABLE_APK_URL,featuredReleaseMetadata,apkUrl,installZipUrl}=await previous138ReleaseModule();
import {candidateReleaseProvenance as proof,restoreCandidateReleaseBaseline as restore,previous137ReleaseModule} from './candidate-release-preservation-helpers.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const read=name=>restoreChoiceReleaseBaseline(name,readFileSync(new URL('../../'+name,import.meta.url)));
const verified=JSON.parse(readFileSync(new URL('./fixtures/verified-apk-1.3.8.json',import.meta.url),'utf8'));
test('1.3.8 changes only the two reviewed download paths from the latest deployed source',()=>{
 assert.equal(proof.baselineSourceCommit,'f4f09b73c290a4611b061ee3109c635fcbbd7412');assert.equal(proof.baselineTree,'253845467b446c46dc615bb05b5e59b4d0fb2cbf');
 for(const change of proof.changes){const current=read(change.path);assert.equal(hash(current),change.afterSha256);const before=restore(change.path,current);assert.equal(hash(before),change.beforeSha256);assert.strictEqual(restore(change.path,before),before);assert.throws(()=>restore(change.path,Buffer.concat([current,Buffer.from('UNREVIEWED')])),/exact verified preview release bytes for 1.3.8 update/);}
});
test('1.3.8 preserves every old fixture, UI/printing/date feature, catalog, translations and data channel',()=>{
 for(const[name,expected]of Object.entries(proof.unchangedFileSha256))assert.equal(hash(read(name)),expected,name);
 const catalog=JSON.parse(read('website/public/cards.json'));assert.equal(catalog.displayTranslations.revision,'59a34c25c0e27077ac3f19dca87cc2f7a68248f098c743768678206b833328f7');assert.equal(hash(read('website/public/cards.json')),'b879faeda2824affcb378e965010a13b1b50da4b473fb23819f6c6834385d3fa');
});
test('1.3.8 metadata uses verified assets and does not claim the phone installation or inference fixed',()=>{
 const value=featuredReleaseMetadata(verified);assert.equal(FEATURED_TAG,'v1.3.8');assert.equal(value.version,'v1.3.8');assert.equal(value.size,628873695);assert.equal(value.sha256,'bf926c7a1e5a63b3ae190054d9ee5f548540ed12f5b1340772f73d8f80c818e2');assert.equal(value.installZipAvailable,true);
 assert.equal(apkUrl(value.version),'https://github.com/luckymatthew/Hololen/releases/download/v1.3.8/HoloLens.apk');assert.equal(installZipUrl(value.version),'https://github.com/luckymatthew/Hololen/releases/download/v1.3.8/Hololens-1.3.8-Install.zip');
 assert.match(FEATURED_METADATA.notes,/Adds the installed version/);assert.match(FEATURED_METADATA.notes,/confirmed Android ICU/);assert.match(FEATURED_METADATA.notes,/NOT a proven fix/);assert.match(FEATURED_METADATA.notes,/invalid-package/);assert.match(FEATURED_METADATA.notes,/NOT a claim of successful phone inference/);assert.match(FEATURED_METADATA.notes,/345\/352/);assert.match(FEATURED_METADATA.notes,/seven unchanged/);assert.match(FEATURED_METADATA.notes,/not all-green/);assert.match(FEATURED_METADATA.notes,/No live OAuth/);assert.match(FEATURED_METADATA.notes,/1\.4\.0 engine candidate is not included/);
});
test('the exact previous 1.3.7 contract is retained and cannot replace the current preview or stable rollback',async()=>{
 const previous=await previous137ReleaseModule();const old=JSON.parse(readFileSync(new URL('./fixtures/verified-apk-1.3.7.json',import.meta.url),'utf8'));
 assert.equal(previous.featuredReleaseMetadata(old).version,'v1.3.7');assert.throws(()=>featuredReleaseMetadata(old));assert.deepEqual(STABLE_METADATA,previous.STABLE_METADATA);assert.equal(STABLE_APK_URL,previous.STABLE_APK_URL);
});
