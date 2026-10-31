// Test-only outer proof for the verified 1.3.6 download update.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
export const diagnosticReleaseProvenance=JSON.parse(fs.readFileSync(new URL('./fixtures/apk-preview-1.3.6-runtime-changes.json',import.meta.url),'utf8'));
assert.equal(diagnosticReleaseProvenance.status,'verified-diagnostic-download-update');
assert.deepEqual(diagnosticReleaseProvenance.approvedPaths,['website/lib/releases.mjs','website/app/download/DownloadClient.tsx']);
const hash=value=>createHash('sha256').update(value).digest('hex');
export function restoreDiagnosticReleaseBaseline(name,input){
 const relative=name.includes('website/')?name.slice(name.indexOf('website/')):'website/'+name.replace(/^\.\//,'');
 const change=diagnosticReleaseProvenance.changes.find(value=>value.path===relative);if(!change)return input;
 let text=String(input);if(hash(text)===change.beforeSha256)return input;
 assert.equal(hash(text),change.afterSha256,relative+': exact verified preview release bytes for diagnostic update');
 for(const patch of [...change.patches].reverse()){assert.equal(text.split(patch.after).length-1,1);text=text.replace(patch.after,patch.before);}
 assert.equal(hash(text),change.beforeSha256);
 return Buffer.isBuffer(input)?Buffer.from(text):text;
}
