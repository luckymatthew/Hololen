import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {FEATURED_METADATA,FEATURED_TAG,STABLE_METADATA,STABLE_APK_URL,featuredReleaseMetadata,apkUrl,installZipUrl} from '../lib/releases.mjs';
import {shapeReleaseProvenance as proof,restoreShapeReleaseBaseline as restore,previous139ReleaseModule} from './shape-release-preservation-helpers.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const read=name=>readFileSync(new URL('../../'+name,import.meta.url));
const verified=JSON.parse(readFileSync(new URL('./fixtures/verified-apk-1.3.10.json',import.meta.url),'utf8'));

test('1.3.10 changes only reviewed download metadata from the latest deployed source',()=>{
 assert.equal(proof.baselineSourceCommit,'2d3500e7cf0adb3c6241f3a0fe965cba6f1c61e5');assert.equal(proof.baselineTree,'9b627845020389df9612f24d4f93abf57ba9b219');
 for(const change of proof.changes){const current=read(change.path);assert.equal(hash(current),change.afterSha256);const before=restore(change.path,current);assert.equal(hash(before),change.beforeSha256);assert.strictEqual(restore(change.path,before),before);assert.throws(()=>restore(change.path,Buffer.concat([current,Buffer.from('UNREVIEWED')])),/exact verified preview release bytes for 1.3.10 update/);}
});

test('1.3.10 preserves historical fixtures, printings, shared limits, dates, translations and update-channel bytes',()=>{
 for(const[name,expected]of Object.entries(proof.unchangedFileSha256))assert.equal(hash(read(name)),expected,name);
 const catalog=JSON.parse(read('website/public/cards.json'));assert.equal(catalog.displayTranslations.revision,'59a34c25c0e27077ac3f19dca87cc2f7a68248f098c743768678206b833328f7');assert.equal(hash(read('website/public/cards.json')),'b879faeda2824affcb378e965010a13b1b50da4b473fb23819f6c6834385d3fa');
});

test('1.3.10 advertises bounded structure diagnostics without claiming a battle fix',()=>{
 const value=featuredReleaseMetadata(verified);assert.equal(FEATURED_TAG,'v1.3.10');assert.equal(value.version,'v1.3.10');assert.equal(value.size,628873695);assert.equal(value.sha256,'c15adf14732a6150712574d2bc17a00a40089c4e497b3f51e3e95fd6b2b2c8c1');assert.equal(value.installZipAvailable,true);
 assert.equal(apkUrl(value.version),'https://github.com/luckymatthew/Hololen/releases/download/v1.3.10/HoloLens.apk');assert.equal(installZipUrl(value.version),'https://github.com/luckymatthew/Hololen/releases/download/v1.3.10/Hololens-1.3.10-Install.zip');
 assert.match(FEATURED_METADATA.notes,/RS1/);assert.match(FEATURED_METADATA.notes,/fixed structure codes and capped counts/);assert.match(FEATURED_METADATA.notes,/does not retain raw replies/);assert.match(FEATURED_METADATA.notes,/does not upload telemetry/);assert.match(FEATURED_METADATA.notes,/not a confirmed battle fix/);assert.match(FEATURED_METADATA.notes,/385\/392/);assert.match(FEATURED_METADATA.notes,/same seven/);assert.match(FEATURED_METADATA.notes,/same seven documented Windows directory-sync failures/);assert.match(FEATURED_METADATA.notes,/No live OAuth/);assert.match(FEATURED_METADATA.notes,/1\.4\.0 new-card engine is not included/);
});

test('previous 1.3.9 and stable rollback remain available without replacing the new preview',async()=>{
 const previous=await previous139ReleaseModule();const old=JSON.parse(readFileSync(new URL('./fixtures/verified-apk-1.3.9.json',import.meta.url),'utf8'));
 assert.equal(previous.featuredReleaseMetadata(old).version,'v1.3.9');assert.throws(()=>featuredReleaseMetadata(old));assert.deepEqual(STABLE_METADATA,previous.STABLE_METADATA);assert.equal(STABLE_APK_URL,previous.STABLE_APK_URL);
});
