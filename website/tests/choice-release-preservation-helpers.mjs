import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
export const choiceReleaseProvenance=JSON.parse(fs.readFileSync(new URL('./fixtures/apk-preview-1.3.9-runtime-changes.json',import.meta.url),'utf8'));
assert.equal(choiceReleaseProvenance.status,'verified-1.3.9-choice-download-update');
assert.deepEqual(choiceReleaseProvenance.approvedPaths,['website/lib/releases.mjs','website/app/download/DownloadClient.tsx']);
const hash=value=>createHash('sha256').update(value).digest('hex');
export function restoreChoiceReleaseBaseline(name,input){
 const normalized=name.replaceAll('\\','/');const relative=normalized.includes('website/')?normalized.slice(normalized.indexOf('website/')):'website/'+normalized.replace(/^\.\//,'');
 const change=choiceReleaseProvenance.changes.find(item=>item.path===relative);if(!change)return input;
 let text=String(input);if(hash(text)===change.beforeSha256)return input;
 assert.equal(hash(text),change.afterSha256,relative+': exact verified preview release bytes for 1.3.9 update');
 for(const patch of [...change.patches].reverse()){assert.ok(patch.after.length);assert.equal(text.split(patch.after).length-1,1);text=text.replace(patch.after,patch.before);}
 assert.equal(hash(text),change.beforeSha256);return Buffer.isBuffer(input)?Buffer.from(text):text;
}
export function previous138ReleaseModule(){
 const source=restoreChoiceReleaseBaseline('website/lib/releases.mjs',fs.readFileSync(new URL('../lib/releases.mjs',import.meta.url)));
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
