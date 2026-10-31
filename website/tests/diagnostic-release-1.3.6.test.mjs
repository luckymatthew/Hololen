import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {previous136ReleaseModule,restoreInferenceReleaseBaseline} from './inference-release-preservation-helpers.mjs';
const {FEATURED_METADATA,featuredReleaseMetadata}=await previous136ReleaseModule();
import {diagnosticReleaseProvenance as proof,restoreDiagnosticReleaseBaseline as restore} from './diagnostic-release-preservation-helpers.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const read=name=>restoreInferenceReleaseBaseline(name,readFileSync(new URL('../../'+name,import.meta.url)));

test('1.3.6 reverses exactly the two download paths to the deployed translation repair',()=>{
 assert.equal(proof.baselineSourceCommit,'9cfbeaa78252b9fdd479ad461db605348f07b24a');
 assert.equal(proof.baselineTree,'5d4176090eb3c35f9f956010b14c37481eaf9438');
 for(const change of proof.changes){const current=read(change.path);assert.equal(hash(current),change.afterSha256);assert.equal(hash(restore(change.path,current)),change.beforeSha256);assert.throws(()=>restore(change.path,Buffer.concat([current,Buffer.from('UNREVIEWED')])),/exact verified preview release bytes/);}
});

test('1.3.6 preserves every historical fixture, repaired manifest, translations and retailer implementation',()=>{
 for(const[name,expected]of Object.entries(proof.unchangedFileSha256))assert.equal(hash(read(name)),expected,name);
 const catalog=JSON.parse(read('website/public/cards.json'));assert.equal(catalog.displayTranslations.revision,'59a34c25c0e27077ac3f19dca87cc2f7a68248f098c743768678206b833328f7');
 const log=JSON.parse(read('website/public/website-updates.json'));assert.equal(log.entries[0].catalogSha256,'b879faeda2824affcb378e965010a13b1b50da4b473fb23819f6c6834385d3fa');
});

test('1.3.6 remains an honest diagnostic release and rejects obsolete 1.3.5 metadata',()=>{
 const old=JSON.parse(read('website/tests/fixtures/verified-apk-1.3.5.json'));
 assert.throws(()=>featuredReleaseMetadata(old));
 assert.equal(FEATURED_METADATA.version,'v1.3.6');
 assert.match(FEATURED_METADATA.notes,/diagnostic preview/);assert.match(FEATURED_METADATA.notes,/phone exchange failure remains unidentified/);
 assert.match(FEATURED_METADATA.notes,/seven unchanged/);assert.match(FEATURED_METADATA.notes,/24 cases/);assert.match(FEATURED_METADATA.notes,/not all-green/);
 assert.match(FEATURED_METADATA.notes,/effects remain unsupported/);assert.match(FEATURED_METADATA.notes,/Do not uninstall/);
});
