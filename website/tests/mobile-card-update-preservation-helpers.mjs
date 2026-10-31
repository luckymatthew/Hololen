// Narrow outer proof; all historical translation/card/UI fixtures remain frozen.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
export const mobileUpdateProvenance=JSON.parse(fs.readFileSync(new URL('./fixtures/mobile-card-update-2026-10-31-runtime-changes.json',import.meta.url),'utf8'));
assert.equal(mobileUpdateProvenance.status,'verified-mobile-data-channel-correction');
assert.deepEqual(mobileUpdateProvenance.approvedPaths,['website/public/website-updates.json','website/scripts/build-website-update-log.mjs','website/scripts/check-firebase-build.mjs']);
export const mobileUpdateAddedPaths=mobileUpdateProvenance.addedFiles.map(file=>file.path);
const hash=value=>createHash('sha256').update(value).digest('hex');
export function restoreMobileCardUpdateBaseline(name,input){
 const relative=name.includes('website/')?name.slice(name.indexOf('website/')):`website/${name.replace(/^\.\//,'')}`;
 const change=mobileUpdateProvenance.changes.find(value=>value.path===relative);if(!change)return input;
 let text=String(input);if(hash(text)===change.beforeSha256)return input;
 assert.equal(hash(text),change.afterSha256,`${relative}: exact reviewed mobile update bytes`);
 for(const patch of [...change.patches].reverse()){assert.equal(text.split(patch.after).length-1,1);text=text.replace(patch.after,patch.before);}
 assert.equal(hash(text),change.beforeSha256);return Buffer.isBuffer(input)?Buffer.from(text):text;
}
