import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {previous139ReleaseModule,restoreShapeReleaseBaseline} from './shape-release-preservation-helpers.mjs';
const {FEATURED_METADATA,FEATURED_TAG,STABLE_METADATA,STABLE_APK_URL,featuredReleaseMetadata,apkUrl,installZipUrl}=await previous139ReleaseModule();
import {choiceReleaseProvenance as proof,restoreChoiceReleaseBaseline as restore,previous138ReleaseModule} from './choice-release-preservation-helpers.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const read=name=>restoreShapeReleaseBaseline(name,readFileSync(new URL('../../'+name,import.meta.url)));
const verified=JSON.parse(readFileSync(new URL('./fixtures/verified-apk-1.3.9.json',import.meta.url),'utf8'));

test('1.3.9 changes only the two reviewed download paths from the latest deployed source',()=>{
 assert.equal(proof.baselineSourceCommit,'8fa997134fcc3bffb5214c8b39434522fcb47f04');assert.equal(proof.baselineTree,'10f5628eea9ed841451d07cfe8fb2063f807a96a');
 for(const change of proof.changes){const current=read(change.path);assert.equal(hash(current),change.afterSha256);const before=restore(change.path,current);assert.equal(hash(before),change.beforeSha256);assert.strictEqual(restore(change.path,before),before);assert.throws(()=>restore(change.path,Buffer.concat([current,Buffer.from('UNREVIEWED')])),/exact verified preview release bytes for 1.3.9 update/);}
});

test('1.3.9 preserves old fixtures, UI, independent printings, release dates, translations and the repaired data channel',()=>{
 for(const[name,expected]of Object.entries(proof.unchangedFileSha256))assert.equal(hash(read(name)),expected,name);
 const catalog=JSON.parse(read('website/public/cards.json'));assert.equal(catalog.displayTranslations.revision,'59a34c25c0e27077ac3f19dca87cc2f7a68248f098c743768678206b833328f7');assert.equal(hash(read('website/public/cards.json')),'b879faeda2824affcb378e965010a13b1b50da4b473fb23819f6c6834385d3fa');
});

test('1.3.9 metadata describes the reproducible choice bug without claiming the phone battle verified',()=>{
 const value=featuredReleaseMetadata(verified);assert.equal(FEATURED_TAG,'v1.3.9');assert.equal(value.version,'v1.3.9');assert.equal(value.size,628873695);assert.equal(value.sha256,'0e4a5bbbd3eddf074b198cc9d21ff6709f94b16fe42584bb4f39428b47138c7c');assert.equal(value.installZipAvailable,true);
 assert.equal(apkUrl(value.version),'https://github.com/luckymatthew/Hololen/releases/download/v1.3.9/HoloLens.apk');assert.equal(installZipUrl(value.version),'https://github.com/luckymatthew/Hololen/releases/download/v1.3.9/Hololens-1.3.9-Install.zip');
 assert.match(FEATURED_METADATA.notes,/intermediate commentary/);assert.match(FEATURED_METADATA.notes,/final legal-choice JSON/);assert.match(FEATURED_METADATA.notes,/does NOT prove the exact cause/);assert.match(FEATURED_METADATA.notes,/live inference remain unverified/);assert.match(FEATURED_METADATA.notes,/367\/374/);assert.match(FEATURED_METADATA.notes,/same seven/);assert.match(FEATURED_METADATA.notes,/not all-green/);assert.match(FEATURED_METADATA.notes,/No live OAuth/);assert.match(FEATURED_METADATA.notes,/1\.4\.0 new-card engine candidate is not included/);
});

test('the exact previous 1.3.8 contract and stable rollback remain available',async()=>{
 const previous=await previous138ReleaseModule();const old=JSON.parse(readFileSync(new URL('./fixtures/verified-apk-1.3.8.json',import.meta.url),'utf8'));
 assert.equal(previous.featuredReleaseMetadata(old).version,'v1.3.8');assert.throws(()=>featuredReleaseMetadata(old));assert.deepEqual(STABLE_METADATA,previous.STABLE_METADATA);assert.equal(STABLE_APK_URL,previous.STABLE_APK_URL);
});
