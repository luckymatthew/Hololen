// Offline interaction tests; future-version payloads below are synthetic fixtures,
// never claims that another release has been uploaded or published.
import assert from 'node:assert/strict';
import { mkdirSync, unlinkSync, readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import test from 'node:test';
import { FEATURED_METADATA, APK_FILENAME, apkUrl, installZipUrl, releaseUrl } from '../lib/releases.mjs';
import { apkReleaseProvenance } from './apk-release-preservation-helpers.mjs';

assert.equal(apkReleaseProvenance.status, 'verified-source-update');
let bundleIndex = 0;

async function workspace(t, { immediateTimeout = false } = {}) {
  const dom = new JSDOM('<main id="root"></main>', { url: 'https://hololive-ocg.web.app/download', pretendToBeVisual: true });
  const keys = ['window', 'document', 'HTMLElement', 'Event', 'localStorage', 'location', 'navigator'];
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key] });
  dom.window.matchMedia = query => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
  const oldFetch = globalThis.fetch, oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT, oldSetTimeout = globalThis.setTimeout;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.setTimeout = (callback, milliseconds, ...args) => oldSetTimeout(callback, immediateTimeout && milliseconds === 8000 ? 0 : milliseconds, ...args);
  const requests = [];
  globalThis.fetch = (url, options = {}) => new Promise((resolve, reject) => {
    const request = { url, options, resolve, reject }; requests.push(request);
    options.signal?.addEventListener('abort', () => { const error = new Error('Synthetic abort'); error.name = 'AbortError'; reject(error); }, { once: true });
  });
  localStorage.setItem('preserve-unrelated-deck', '{"deck":true}');
  mkdirSync('work', { recursive: true });
  const outfile = `work/download-release-test-${process.pid}-${bundleIndex++}.mjs`;
  await build({ entryPoints: ['app/download/DownloadClient.tsx'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', alias: { '@': process.cwd(), 'next/link': './firebase/Link.tsx' }, define: { 'import.meta.env': JSON.stringify({ VITE_APP_BACKEND: 'firebase' }) } });
  const { default: DownloadClient } = await import(new URL(`../${outfile}`, import.meta.url));
  const { createElement, act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  let root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(createElement(DownloadClient)); });
  const settle = () => new Promise(resolve => oldSetTimeout(resolve, 25));
  const respond = async (payload, status = 200) => { await act(async () => { requests[0].resolve(Response.json(payload, { status })); await settle(); }); };
  const fail = async () => { await act(async () => { requests[0].reject(new Error('Synthetic network failure')); await settle(); }); };
  const wait = async () => { await act(async () => { await settle(); }); };
  const unmount = async () => { if (root) { await act(async () => root.unmount()); root = null; } };
  t.after(async () => {
    await unmount(); dom.window.close(); unlinkSync(outfile);
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    globalThis.fetch = oldFetch; globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct; globalThis.setTimeout = oldSetTimeout;
  });
  return { dom, requests, respond, fail, wait, unmount };
}

function fixture({ version = 'v1.3.9', zip = false, digest = `sha256:${FEATURED_METADATA.sha256}`, body = 'Synthetic release notes; not a published future release.' } = {}) {
  const size = version === 'v1.3.9' ? 628873695 : 628873696;
  return { tag_name: version, name: `Synthetic ${version} metadata`, published_at: FEATURED_METADATA.date, body, draft: false, prerelease: true, assets: [
    { name: APK_FILENAME, state: 'uploaded', size, digest, browser_download_url: apkUrl(version) },
    ...(zip ? [{ name: `Hololens-${version.slice(1)}-Install.zip`, state: 'uploaded', size: 628876350, digest: 'sha256:fbaf1a6f0200430671d8781ee6019af139c358249f33c1bc11edeb34dfab6654', browser_download_url: installZipUrl(version) }] : []),
  ] };
}

const primary = () => document.querySelector('.apk-button');
const zipLinks = () => [...document.querySelectorAll('.download-links a')].filter(anchor => /ZIP/i.test(anchor.textContent));

function assertPinnedFallback() {
  assert.equal(primary().getAttribute('href'), apkUrl('v1.3.9'));
  assert.equal(document.querySelector('.release-details h2').textContent, 'v1.3.9');
  assert.ok(document.body.textContent.includes('0e4a5bbbd3eddf074b198cc9d21ff6709f94b16fe42584bb4f39428b47138c7c'));
}

test('download page retains verified pinned version, public URL and integrity information after API failure', async t => {
  const ui = await workspace(t);
  assertPinnedFallback(); assert.equal(ui.requests.length, 1);
  assert.match(ui.requests[0].url, /releases\/tags\/v1\.3\.9$/);
  assert.equal(ui.requests[0].options.credentials, 'omit'); assert.equal(ui.requests[0].options.cache, 'no-store');
  assert.equal(zipLinks().length, FEATURED_METADATA.installZipAvailable ? 1 : 0);
  await ui.fail(); assertPinnedFallback(); assert.match(document.querySelector('[role="status"]').textContent, /1\.3\.9/);
  assert.equal(localStorage.getItem('preserve-unrelated-deck'), '{"deck":true}');
});

test('timeout and unmount abort metadata requests without replacing the fallback or touching decks', async t => {
  const ui = await workspace(t, { immediateTimeout: true }); await ui.wait();
  assert.equal(ui.requests[0].options.signal.aborted, true); assertPinnedFallback();
  assert.equal(localStorage.getItem('preserve-unrelated-deck'), '{"deck":true}');
  await ui.unmount(); assert.equal(document.getElementById('root').childElementCount, 0);
});

test('unmount during a pending query rejects late metadata rather than reviving the page', async t => {
  const ui = await workspace(t); await ui.unmount();
  assert.equal(ui.requests[0].options.signal.aborted, true);
  await ui.respond(fixture()); assert.equal(document.getElementById('root').childElementCount, 0);
});

test('unmount while received metadata is still decoding ignores its late JSON result', async t => {
  const ui = await workspace(t);
  let finishJson;
  const json = new Promise(resolve => { finishJson = resolve; });
  ui.requests[0].resolve({ ok: true, json: () => json });
  await ui.wait(); await ui.unmount();
  finishJson(fixture({ version: 'v1.3.9' })); await ui.wait();
  assert.equal(ui.requests[0].options.signal.aborted, true);
  assert.equal(document.getElementById('root').childElementCount, 0);
});

test('published featured preview API metadata keeps version, APK URL and verified optional ZIP paired', async t => {
  const ui = await workspace(t);
  await ui.respond(fixture({ version: 'v1.3.9', zip: true, digest: `sha256:${FEATURED_METADATA.sha256}` }));
  assert.equal(document.querySelector('.release-details h2').textContent, 'v1.3.9');
  assert.equal(primary().getAttribute('href'), apkUrl('v1.3.9'));
  assert.equal(zipLinks().length, 1); assert.equal(zipLinks()[0].getAttribute('href'), installZipUrl('v1.3.9'));
  assert.ok(document.querySelector(`a[href="${releaseUrl('v1.3.9')}"]`));
  assert.match(document.querySelector('.release-notes').textContent, /Synthetic release notes/);
});

test('APK-only metadata does not invent a ZIP asset or preserve a stale version ZIP link', async t => {
  const ui = await workspace(t); await ui.respond(fixture({ version: 'v1.3.9', zip: false, digest: null }));
  assert.equal(primary().getAttribute('href'), apkUrl('v1.3.9')); assert.equal(zipLinks().length, 0);
});

for (const [name, mutate] of [
  ['old release', payload => { payload.tag_name = 'v1.2.7'; }],
  ['draft release', payload => { payload.draft = true; }],
  ['unselected preview release', payload => { payload.tag_name = 'v1.3.1'; }],
  ['stable latest response', payload => { payload.tag_name = 'v1.2.8'; payload.prerelease = false; }],
  ['preview channel mismatch', payload => { payload.prerelease = false; }],
  ['same-tag incorrect size', payload => { payload.assets[0].size++; }],
  ['same-tag incorrect digest', payload => { payload.assets[0].digest = `sha256:${'0'.repeat(64)}`; }],
  ['missing uploaded APK', payload => { payload.assets[0].state = 'new'; }],
]) test(`download page ignores ${name} and preserves verified fallback`, async t => {
  const ui = await workspace(t); const payload = fixture(); mutate(payload); await ui.respond(payload); assertPinnedFallback();
});

test('backup, device/camera, dual-device PvP and unsupported manual-effects limitations are visible without exposing private source', async t => {
  const ui = await workspace(t); await ui.fail(); const text = document.querySelector('.download-page').textContent;
  assert.match(text, /備份/); assert.match(text, /真機|實機/); assert.match(text, /相機|鏡頭/); assert.match(text, /雙機|雙裝置|雙設備/); assert.match(text, /PvP|多人對戰/); assert.match(text, /未支援|不會自動|手動/);
  assert.doesNotMatch(text, /可保留現有牌組與對局/);
  const url = new URL(primary().href); assert.equal(url.origin, 'https://github.com'); assert.equal(url.pathname, '/luckymatthew/Hololen/releases/download/v1.3.9/HoloLens.apk');
  assert.equal(document.querySelector('input[type="password"], input[name="token"], iframe'), null);
});

test('release notes remain inert text rather than executable HTML', async t => {
  const ui = await workspace(t); await ui.respond(fixture({ body: '<script>syntheticUntrustedNotes()</script><img src="https://example.invalid/private-source">' }));
  assert.equal(document.querySelector('.release-notes script, .release-notes img'), null);
});

for (const [name, mutate] of [
  ['wrong ZIP filename', zip => { zip.name = 'unverified-install.zip'; }],
  ['unuploaded ZIP', zip => { zip.state = 'new'; }],
  ['empty ZIP', zip => { zip.size = 0; }],
]) test(`unverified optional asset is hidden: ${name}`, async t => {
  const ui = await workspace(t); const payload = fixture({ version: 'v1.3.9', zip: true, digest: null }); mutate(payload.assets[1]);
  await ui.respond(payload); assert.equal(primary().getAttribute('href'), apkUrl('v1.3.9')); assert.equal(zipLinks().length, 0);
});

test('HTTP metadata failure leaves the known verified APK downloadable', async t => {
  const ui = await workspace(t); await ui.respond({ message: 'Synthetic service failure' }, 503); assertPinnedFallback();
});


test('known-broken 1.3.2 metadata cannot replace the verified hotfix or its in-place update guidance', async t => {
  const ui = await workspace(t);
  const previous = JSON.parse(readFileSync(new URL('./fixtures/verified-apk-1.3.2.json', import.meta.url), 'utf8'));
  await ui.respond(previous); assertPinnedFallback();
  const text = document.querySelector('.download-page').textContent;
  assert.match(text, /啟動修正/); assert.match(text, /真機啟動驗證/);
  assert.match(text, /請勿解除安裝或清除資料/);
  assert.equal(document.querySelector('a[href*="/releases/download/v1.3.2/"]'), null);
});


test('layout correction is visible and older 1.3.3 metadata cannot replace its verified APK', async t => {
  const ui = await workspace(t);
  const previous = JSON.parse(readFileSync(new URL('./fixtures/verified-apk-1.3.3.json', import.meta.url), 'utf8'));
  await ui.respond(previous); assertPinnedFallback();
  const text = document.querySelector('.download-page').textContent;
  assert.match(text, /恢復原有首頁版面/); assert.match(text, /holomem 立繪大小/);
  assert.match(text, /交換掃描／對戰按鈕/); assert.match(text, /相機圖示/);
  assert.equal(document.querySelector('a[href*="/releases/download/v1.3.3/"]'), null);
});


test('layout correction is visible and older 1.3.4 metadata cannot replace its verified APK', async t => {
  const ui = await workspace(t);
  const previous = JSON.parse(readFileSync(new URL('./fixtures/verified-apk-1.3.4.json', import.meta.url), 'utf8'));
  await ui.respond(previous); assertPinnedFallback();
  const text = document.querySelector('.download-page').textContent;
  assert.match(text, /恢復原有首頁版面/); assert.match(text, /holomem 立繪大小/);
  assert.match(text, /交換掃描／對戰按鈕/); assert.match(text, /相機圖示/);
  assert.equal(document.querySelector('a[href*="/releases/download/v1.3.4/"]'), null);
});


test('diagnostic connection notice states the remaining live-login uncertainty without losing original layout guidance', async t => {
  const ui = await workspace(t); await ui.fail();
  const text = document.querySelector('.download-page').textContent;
  assert.match(text, /ChatGPT/); assert.match(text, /對戰階段與錯誤/);
  assert.match(text, /實機 ChatGPT 對戰仍未驗證/);
  assert.match(text, /登入或授權成功不代表對戰請求已成功/);
  assert.match(text, /holomem 立繪大小/); assert.match(text, /請勿解除安裝/);
  assertPinnedFallback();
});


test('older 1.3.5 metadata cannot replace the verified diagnostic APK',async t=>{
 const ui=await workspace(t);
 const previous=JSON.parse(readFileSync(new URL('./fixtures/verified-apk-1.3.5.json',import.meta.url),'utf8'));
 await ui.respond(previous);assertPinnedFallback();
 const text=document.querySelector('.download-page').textContent;
 assert.match(text,/對戰答案驗證/);assert.match(text,/實機 ChatGPT 對戰仍未驗證/);
 assert.equal(document.querySelector('a[href*="/releases/download/v1.3.5/"]'),null);
});


test('older 1.3.6 cannot replace 1.3.9 and the page explains inference and duplicate-login fixes honestly',async t=>{
 const ui=await workspace(t);const previous=JSON.parse(readFileSync(new URL('./fixtures/verified-apk-1.3.6.json',import.meta.url),'utf8'));await ui.respond(previous);assertPinnedFallback();
 const text=document.querySelector('.download-page').textContent;assert.match(text,/對戰答案驗證/);assert.match(text,/重複登入按鈕/);assert.match(text,/實機 ChatGPT 對戰仍未驗證/);assert.equal(document.querySelector('a[href*="/releases/download/v1.3.6/"]'),null);
});

test('older 1.3.7 cannot replace 1.3.9 and visible diagnostics do not promise a fixed install',async t=>{
 const ui=await workspace(t);const previous=JSON.parse(readFileSync(new URL('./fixtures/verified-apk-1.3.7.json',import.meta.url),'utf8'));await ui.respond(previous);assertPinnedFallback();
 const text=document.querySelector('.download-page').textContent;assert.match(text,/最終合法選項/);assert.match(text,/原始回覆未取得/);assert.match(text,/不能保證是同一原因/);assert.match(text,/實機 ChatGPT 對戰仍未驗證/);assert.equal(document.querySelector('a[href*="/releases/download/v1.3.7/"]'),null);
});

test('older 1.3.8 cannot replace 1.3.9 and choice diagnostics do not promise phone inference',async t=>{
 const ui=await workspace(t);const previous=JSON.parse(readFileSync(new URL('./fixtures/verified-apk-1.3.8.json',import.meta.url),'utf8'));await ui.respond(previous);assertPinnedFallback();
 const text=document.querySelector('.download-page').textContent;assert.match(text,/最終合法選項/);assert.match(text,/原始回覆未取得/);assert.match(text,/不能保證是同一原因/);assert.match(text,/實機 ChatGPT 對戰仍未驗證/);assert.equal(document.querySelector('a[href*="/releases/download/v1.3.8/"]'),null);
});
