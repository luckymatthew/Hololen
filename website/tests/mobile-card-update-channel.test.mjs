import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { validateMobileCardUpdate } from '../lib/mobile-card-update.mjs';
import { appendWebsiteTranslationUpdate } from '../scripts/build-website-update-log.mjs';
import { translationInput } from './website-translation-log-fixtures.mjs';
import { mobileUpdateProvenance, restoreMobileCardUpdateBaseline } from './mobile-card-update-preservation-helpers.mjs';
const bytes=fs.readFileSync(new URL('../public/cards.json',import.meta.url)),log=JSON.parse(fs.readFileSync(new URL('../public/website-updates.json',import.meta.url),'utf8'));
const digest=value=>createHash('sha256').update(value).digest('hex');
const validate=value=>validateMobileCardUpdate({log:value,catalogBytes:bytes});

test('current translation offer is consumable by the released paired-field contract and hashes all translated bytes',()=>{
 const offer=validate(log);assert.equal(offer.digest,'b879faeda2824affcb378e965010a13b1b50da4b473fb23819f6c6834385d3fa');assert.equal(offer.date,'2026-10-30');assert.equal(offer.version,'2026-10-29-official-cardlist');assert.equal(log.entries[0].kind,'translation');assert.equal(log.entries[0].catalogSha256,digest(bytes));assert.equal(log.entries[0].sourceCatalogSha256,log.entries[0].catalogSha256);
});

test('the exact previously deployed missing-hash regression is rejected rather than falling back to stale history',()=>{
 const broken=structuredClone(log);delete broken.entries[0].catalogSha256;assert.equal(broken.entries[0].sourceCatalogSha256,digest(bytes));assert.throws(()=>validate(broken),/catalogSha256/);
 const historical=restoreMobileCardUpdateBaseline('website/public/website-updates.json',fs.readFileSync(new URL('../public/website-updates.json',import.meta.url)));assert.equal(digest(historical),'0494698f8f6f3239d2f8daf8a5d2d6f11cf16fd66a7ca3d1a7442e96b20f6934');
});

test('new translation-only offers retain IDs and expose the full catalog hash under the native transport field',()=>{
 const input=translationInput(),output=appendWebsiteTranslationUpdate(input),entry=output.entries[0];assert.equal(entry.catalogSha256,digest(input.catalogBytes));assert.deepEqual(validateMobileCardUpdate({log:output,catalogBytes:input.catalogBytes}),{version:JSON.parse(input.catalogBytes).meta.catalogVersion,digest:digest(input.catalogBytes),date:'2026-10-30'});assert.equal(entry.counts.newCards,0);assert.equal(entry.counts.newPrintings,0);assert.deepEqual(output.entries[1],input.previous.entries[0]);
});

test('one translated character changes the offered payload digest without requiring a catalogVersion change',()=>{
 const catalog=JSON.parse(bytes),before=structuredClone(catalog.cards);catalog.displayTranslations.cards['hSD21-002'].fields.find(f=>f.path==='keyword.effect').translation+=String.fromCodePoint(0x3002);const changed=Buffer.from(JSON.stringify(catalog));const next=structuredClone(log);next.entries[0].catalogSha256=digest(changed);assert.notEqual(next.entries[0].catalogSha256,log.entries[0].catalogSha256);assert.equal(validateMobileCardUpdate({log:next,catalogBytes:changed}).version,validate(log).version);assert.deepEqual(catalog.cards,before);assert.throws(()=>validateMobileCardUpdate({log,catalogBytes:changed}),/does not match/);
});

for(const[name,mutate]of[
 ['missing version',row=>delete row.catalogVersion],['bad digest',row=>row.catalogSha256='0'.repeat(64)],['invalid date',row=>row.date='2026-02-31'],['negative counts',row=>row.counts.newCards=-1],['non-integer counts',row=>row.counts.newPrintings=0.5],['invalid counts object',row=>row.counts=null],
])test(`mobile update publication rejects ${name}`,()=>{const changed=structuredClone(log);mutate(changed.entries[0]);assert.throws(()=>validate(changed));});

test('same-day offers preserve manifest order exactly as the released reader does',()=>{
 const next=structuredClone(log);next.entries[1].date=next.entries[0].date;assert.equal(validate(next).digest,next.entries[0].catalogSha256);next.entries.reverse();assert.throws(()=>validate(next),/does not match/);
});

test('the correction has an exact outer proof and does not alter frozen fixture hashes or canonical card data',()=>{
 assert.equal(mobileUpdateProvenance.baselineSourceCommit,'cb2385e454d5e30bd8a2aa6f1bf4a8a29a932103');
 for(const change of mobileUpdateProvenance.changes){const current=fs.readFileSync(new URL(`../../${change.path}`,import.meta.url));assert.equal(digest(current),change.afterSha256);assert.equal(digest(restoreMobileCardUpdateBaseline(change.path,current)),change.beforeSha256);assert.throws(()=>restoreMobileCardUpdateBaseline(change.path,Buffer.concat([current,Buffer.from('unreviewed')])),/exact reviewed/);}
 for(const added of mobileUpdateProvenance.addedFiles)assert.equal(digest(fs.readFileSync(new URL(`../../${added.path}`,import.meta.url))),added.sha256);
 assert.equal(digest(bytes),'b879faeda2824affcb378e965010a13b1b50da4b473fb23819f6c6834385d3fa');
 const previous=JSON.parse(restoreMobileCardUpdateBaseline('website/public/website-updates.json',fs.readFileSync(new URL('../public/website-updates.json',import.meta.url),'utf8')));const current=structuredClone(log);delete current.entries[0].catalogSha256;assert.deepEqual(current,previous);
});

function artifact(t){
 const prefix=path.join(os.tmpdir(),'hololen-mobile-channel-'),directory=fs.mkdtempSync(prefix);t.after(()=>{const resolved=fs.realpathSync(directory),temporary=fs.realpathSync(os.tmpdir());assert.equal(path.dirname(resolved),temporary);assert.ok(path.basename(resolved).startsWith('hololen-mobile-channel-'));fs.rmSync(resolved,{recursive:true});});
 for(const folder of ['public','dist-firebase']){fs.mkdirSync(path.join(directory,folder));for(const name of ['cards.json','hbp09-zh-Hant.json','official-cards-zh-Hant.json','website-updates.json'])fs.copyFileSync(new URL(`../public/${name}`,import.meta.url),path.join(directory,folder,name));}
 fs.writeFileSync(path.join(directory,'dist-firebase/index.html'),'<script src="/assets/test.js"></script>');return directory;
}
function guard(directory){return spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/check-firebase-build.mjs',import.meta.url))],{cwd:directory,encoding:'utf8',env:{...process.env,VITE_FIREBASE_API_KEY:'test-fixture',VITE_FIREBASE_APP_ID:'test-fixture',VITE_FIREBASE_DATABASE_URL:'test-fixture'}});}

test('the actual Hosting guard accepts the complete source and artifact mobile channel',t=>{const directory=artifact(t),run=guard(directory);assert.equal(run.status,0,run.stdout+run.stderr);});
test('the actual Hosting guard rejects the reproduced missing-hash artifact before deployment',t=>{const directory=artifact(t),broken=structuredClone(log);delete broken.entries[0].catalogSha256;fs.writeFileSync(path.join(directory,'dist-firebase/website-updates.json'),JSON.stringify(broken));const run=guard(directory);assert.notEqual(run.status,0);assert.match(run.stderr,/catalogSha256/);});
test('the actual Hosting guard rejects an artifact with different history even if its latest offer matches',t=>{const directory=artifact(t),changed=structuredClone(log);changed.entries[0].summary.push('Synthetic differing artifact history');fs.writeFileSync(path.join(directory,'dist-firebase/website-updates.json'),JSON.stringify(changed));const run=guard(directory);assert.notEqual(run.status,0);assert.match(run.stderr,/does not match tested source bytes/);});
