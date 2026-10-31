import { restoreMobileCardUpdateBaseline } from './mobile-card-update-preservation-helpers.mjs';
import { restorePrintingBaseline } from './printing-catalog-preservation-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { translationProvenance, restoreTranslationBaseline } from './translation-preservation-helpers.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const read=name=>fs.readFileSync(new URL(`../../${name}`,import.meta.url));
test('translation layer pins only explicit reviewed changes and rejects any additional runtime bytes',()=>{
 assert.equal(translationProvenance.baselineSourceCommit,'7db44c004769f0566f9271d8c78cbebfb4ae4efa');
 assert.equal(translationProvenance.baselineTree,'3057a57b827adb0da4117fd12d764951dd509077');
 for(const change of translationProvenance.changes){const current=restorePrintingBaseline(change.path,restoreMobileCardUpdateBaseline(change.path,read(change.path)));assert.equal(hash(current),change.afterSha256);assert.equal(hash(restoreTranslationBaseline(change.path,current)),change.beforeSha256);assert.throws(()=>restoreTranslationBaseline(change.path,Buffer.concat([current,Buffer.from('\nUNREVIEWED')])),/exact reviewed/);}
 for(const added of translationProvenance.addedFiles)assert.equal(hash(read(added.path)),added.sha256);
});
test('only embedded display metadata changes catalog bytes; all Japanese cards/meta/printing identities stay exact',()=>{
 const bytes=restoreTranslationBaseline('website/public/cards.json',read('website/public/cards.json'));
 assert.equal(hash(bytes),'75814dea892ac79fdf2ad9dd09987c117c870163b9e903b63533df22be2119ac');
 const cards=JSON.parse(bytes).cards;assert.equal(cards.length,1416);assert.equal(cards.reduce((n,c)=>n+c.variants.length,0),3038);
 assert.equal(new Set(cards.map(c=>c.id)).size,1416);assert.equal(new Set(cards.flatMap(c=>c.variants.map(v=>v.id))).size,3038);
});
test('old illustrated log and legacy native translation payload remain immutable',()=>{
 assert.equal(hash(restoreTranslationBaseline('website/public/website-updates.json',read('website/public/website-updates.json'))),'e1fda4a1ff6e5053972ae5e16ed1b9af3ebaf4f989e4c2ec0bca3e115b6ca0b9');
 assert.equal(hash(read('website/public/hbp09-zh-Hant.json')),'30433cb33c9376877ed7c56076e2ef598dc4d5e8d141ccf13464b13f70458a5a');
 const log=JSON.parse(read('website/public/website-updates.json'));assert.equal(log.entries.length,2);assert.equal(log.entries[0].kind,'translation');assert.equal(log.entries[0].counts.translatedCards,22);assert.equal(log.entries[0].counts.newCards,0);assert.equal(log.entries[0].counts.newPrintings,0);assert.equal(log.entries[1].cards.length,57);
});
