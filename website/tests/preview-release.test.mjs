import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {FEATURED_METADATA,FEATURED_RELEASE_API,STABLE_METADATA,STABLE_APK_URL,featuredReleaseMetadata,releaseMetadata,apkUrl,installZipUrl} from '../lib/releases.mjs';
import {restorePreviewReleaseBaseline,previewReleaseProvenance} from './preview-release-preservation-helpers.mjs';
const verified=JSON.parse(readFileSync(new URL('./fixtures/verified-apk-1.3.4.json',import.meta.url),'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');

test('featured preview exactly matches the publicly verified APK and ZIP while stable rollback stays available',()=>{
 const value=featuredReleaseMetadata(verified);
 assert.equal(value.version,'v1.3.4');assert.equal(value.preview,true);assert.equal(value.size,627915056);
 assert.equal(value.date,'2026-10-30T18:46:09Z');assert.equal(value.sha256,'01fe0f70fcbe9c5ae0a03f9d864c876c082e509b9515231b564a1ef69fa3c564');
 assert.equal(value.installZipAvailable,true);assert.equal(FEATURED_METADATA.sha256,value.sha256);
 assert.equal(FEATURED_RELEASE_API,'https://api.github.com/repos/luckymatthew/Hololen/releases/tags/v1.3.4');
 assert.equal(STABLE_METADATA.version,'v1.2.8');assert.equal(STABLE_APK_URL,apkUrl('v1.2.8'));
 assert.equal(installZipUrl(value.version),'https://github.com/luckymatthew/Hololen/releases/download/v1.3.4/Hololens-1.3.4-Install.zip');
 assert.throws(()=>releaseMetadata(verified),'stable parser must keep rejecting prereleases');
});

test('featured parser rejects drafts, other tags/channels, corrupt APK identity and absent uploads',()=>{
 const mutations=[p=>p.draft=true,p=>p.prerelease=false,p=>p.tag_name='v1.2.8',p=>p.tag_name='v1.4.0',p=>p.assets=[],p=>p.published_at='invalid',p=>p.assets.find(a=>a.name==='HoloLens.apk').size++,p=>p.assets.find(a=>a.name==='HoloLens.apk').digest='sha256:'+'0'.repeat(64),p=>p.assets.find(a=>a.name==='HoloLens.apk').state='new'];
 for(const mutate of mutations){const payload=structuredClone(verified);mutate(payload);assert.throws(()=>featuredReleaseMetadata(payload));}
});

test('optional ZIP must retain verified name, size and digest; payload URLs never select a download host',()=>{
 for(const mutate of [a=>a.size++,a=>a.digest='sha256:'+'0'.repeat(64),a=>a.name='invented.zip',a=>a.state='new']){
  const payload=structuredClone(verified);mutate(payload.assets.find(a=>a.name==='Hololens-1.3.4-Install.zip'));assert.equal(featuredReleaseMetadata(payload).installZipAvailable,false);
 }
 const payload=structuredClone(verified);payload.assets.find(a=>a.name==='HoloLens.apk').browser_download_url='https://example.invalid/wrong.apk';
 assert.equal(apkUrl(featuredReleaseMetadata(payload).version),'https://github.com/luckymatthew/Hololen/releases/download/v1.3.4/HoloLens.apk');
});

test('new release proof reverses only the two approved paths and preserves all older source fixtures',()=>{
 assert.equal(previewReleaseProvenance.baselineTree,'55aa43d2c1b9415d6ad3e5f28e46764195b2cb90');
 for(const change of previewReleaseProvenance.changes){const current=readFileSync(new URL(`../../${change.path}`,import.meta.url));assert.equal(hash(current),change.afterSha256);assert.equal(hash(restorePreviewReleaseBaseline(change.path,current)),change.beforeSha256);assert.throws(()=>restorePreviewReleaseBaseline(change.path,Buffer.concat([current,Buffer.from('// unexpected change')])));}
 const data=readFileSync(new URL('../public/cards.json',import.meta.url));assert.equal(restorePreviewReleaseBaseline('website/public/cards.json',data),data);assert.equal(hash(data),'b879faeda2824affcb378e965010a13b1b50da4b473fb23819f6c6834385d3fa');
});
