import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildDisplayTranslations, embedDisplayTranslations, withoutDisplayTranslations, validateEmbeddedDisplayTranslations } from '../scripts/embed-display-translations.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const catalogBytes=fs.readFileSync('public/cards.json'),catalog=JSON.parse(catalogBytes);
const bundles=['hbp09-zh-Hant.json','official-cards-zh-Hant.json'].map(name=>JSON.parse(fs.readFileSync(`public/${name}`)));

test('embedded display-only contract preserves every canonical Japanese card/meta byte and all identities',()=>{
 const base=withoutDisplayTranslations(catalog);
 assert.equal(hash(JSON.stringify(base)),'75814dea892ac79fdf2ad9dd09987c117c870163b9e903b63533df22be2119ac');
 assert.equal(catalog.cards.length,1416);assert.equal(catalog.cards.reduce((n,c)=>n+c.variants.length,0),3038);
 assert.deepEqual(catalog.displayTranslations,buildDisplayTranslations(catalog,bundles));
 assert.equal(catalog.displayTranslations.schemaVersion,1);assert.equal(catalog.displayTranslations.locale,'zh-Hant');
 assert.equal(catalog.displayTranslations.displayOnly,true);assert.equal(catalog.displayTranslations.changesGameplay,false);
 assert.equal(Object.keys(catalog.displayTranslations.cards).length,133);
 assert.equal(Object.values(catalog.displayTranslations.cards).reduce((n,e)=>n+e.fields.length,0),555);
 assert.equal(Object.keys(catalog.displayTranslations.tagDisplay).length,5);
 assert.deepEqual(embedDisplayTranslations(catalog,bundles),catalog);
 assert.equal(validateEmbeddedDisplayTranslations().catalogSha256,hash(catalogBytes));
});
test('translation-only edits change revision/full transport digest while original rules and printing data remain identical',()=>{
 const changed=structuredClone(bundles);changed[1].cards['hSD20-001'].fields.find(f=>f.path==='stageSkill.name').translation+='（顯示校訂）';
 const next=embedDisplayTranslations(catalog,changed);
 assert.notEqual(next.displayTranslations.revision,catalog.displayTranslations.revision);
 assert.notEqual(hash(JSON.stringify(next)),hash(catalogBytes));
 assert.deepEqual(withoutDisplayTranslations(next),withoutDisplayTranslations(catalog));
 assert.deepEqual(embedDisplayTranslations(next,changed),next,'repeat/no-op build never invents another revision');
});
test('stale Japanese, missing translation and executable/gameplay claims cannot become an activation payload',()=>{
 const stale=structuredClone(catalog);stale.cards.find(c=>c.number==='hSD20-001').stageSkill.effect+='改訂';assert.throws(()=>buildDisplayTranslations(stale,bundles),/sourceSha256|source guard/);
 const missing=structuredClone(bundles);missing[1].cards['hSD20-001'].fields.pop();assert.throws(()=>buildDisplayTranslations(catalog,missing),/required nonempty/);
 const unsafe=structuredClone(bundles);unsafe[1].meta.changesGameplay=true;assert.throws(()=>buildDisplayTranslations(catalog,unsafe),/gameplay|display-only/);
});
