// Explicit outer proof for translation-only presentation/data/gate/log changes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
export const translationProvenance = JSON.parse(fs.readFileSync(new URL('./fixtures/translation-2026-10-30-runtime-changes.json',import.meta.url),'utf8'));
const approved = ['website/app/page.tsx','website/app/simulator/SimulatorClient.tsx','website/lib/card-terminology.mjs','website/app/WebsiteUpdateLog.tsx','website/scripts/build-website-update-log.mjs','website/scripts/check-firebase-build.mjs','website/package.json','website/public/website-updates.json','website/public/cards.json'];
const added = ['website/app/OfficialJapaneseText.tsx','website/lib/official-card-translations.mjs','website/public/official-cards-zh-Hant.json'];
assert.equal(translationProvenance.schemaVersion,1);
assert.equal(translationProvenance.status,'verified-source-update');
assert.deepEqual(translationProvenance.approvedPaths,approved);
assert.deepEqual(translationProvenance.changes.map(change=>change.path),approved);
assert.deepEqual(translationProvenance.approvedAddedPaths,added);
assert.deepEqual(translationProvenance.addedFiles.map(file=>file.path),added);
export const translationAddedPaths = translationProvenance.approvedAddedPaths;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function restoreTranslationBaseline(name,input){
 const relative=name.includes('website/')?name.slice(name.indexOf('website/')):`website/${name.replace(/^\.\//,'')}`;
 const change=translationProvenance.changes.find(change=>change.path===relative);if(!change)return input;
 let text=String(input);const digest=hash(text);
 // The UI proof can receive page bytes already reversed by the older retailer layer.
 const alreadyRetailerReversed = relative === 'website/app/page.tsx' && digest === 'fa58cc43f15ee7d45ff840e9fdf8a8305a4015ae4781cab9d032e8149b76b77c';
 if(digest===change.beforeSha256 || alreadyRetailerReversed)return input;
 assert.equal(hash(text),change.afterSha256,`${relative}: exact reviewed translation-only bytes`);
 if(change.kind === 'embedded-display-metadata'){ const catalog=JSON.parse(text);assert.ok(Object.hasOwn(catalog,'displayTranslations'));delete catalog.displayTranslations;text=JSON.stringify(catalog); }
 else for(const patch of [...change.patches].reverse()){assert.ok(patch.after);assert.equal(text.split(patch.after).length-1,1,`${relative}: unique translation reversal`);text=text.replace(patch.after,patch.before);}
 assert.equal(hash(text),change.beforeSha256,`${relative}: exact pre-translation checkpoint`);return Buffer.isBuffer(input)?Buffer.from(text):text;
}
