import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import test from 'node:test';
import { appendWebsiteTranslationUpdate } from '../scripts/build-website-update-log.mjs';
import { translationInput, legacyHistory } from './website-translation-log-fixtures.mjs';

const payload = () => appendWebsiteTranslationUpdate(translationInput());
let bundleIndex = 0;
async function workspace(t) {
  const dom = new JSDOM('<button id="before">之前焦點</button><main id="root"></main>', { url: 'https://hololive-ocg.web.app/cards', pretendToBeVisual: true });
  const keys = ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Event', 'KeyboardEvent', 'localStorage', 'location'];
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key] });
  const oldFetch = globalThis.fetch, oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.matchMedia = query => ({ matches: query.includes('reduced-motion'), media: query, addEventListener() {}, removeEventListener() {} });
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const requests = []; globalThis.fetch = (url, options) => new Promise(resolve => requests.push({ url, options, resolve }));
  mkdirSync('work', { recursive: true }); const outfile = `work/translation-log-ui-${process.pid}-${bundleIndex++}.mjs`;
  await build({ entryPoints: ['app/WebsiteUpdateLog.tsx'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic' });
  const { default: Component } = await import(new URL(`../${outfile}`, import.meta.url));
  const { createElement, act } = await import('react'), { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root')); await act(async () => root.render(createElement(Component)));
  const settle = () => new Promise(resolve => setTimeout(resolve, 25));
  const click = async element => { await act(async () => { element.click(); await settle(); }); };
  const event = async (element, value) => { await act(async () => { element.dispatchEvent(value); await settle(); }); };
  const open = async () => { const trigger = document.querySelector('.website-update-trigger'); trigger.focus(); await click(trigger); };
  const respond = async (body = payload()) => { await act(async () => { requests.at(-1).resolve(Response.json(body)); await settle(); }); };
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); unlinkSync(outfile); for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } globalThis.fetch = oldFetch; globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct; });
  return { dom, requests, click, event, open, respond };
}

test('translation entries render exact translation counts/old illustrations, never new-card or new-printing badges', async t => {
  const ui = await workspace(t); await ui.open(); const data = payload(); await ui.respond(data);
  const entries = [...document.querySelectorAll('.website-update-entry')], translated = entries[0], old = entries[1];
  assert.equal(entries.length, 2); assert.equal(translated.querySelector('h3').textContent, '繁中翻譯更新');
  assert.match(translated.querySelector('.website-update-counts').textContent, /繁中翻譯 2 個卡號/); assert.match(translated.querySelector('.website-update-counts').textContent, /沒有新增卡號或卡圖/);
  assert.equal(translated.querySelectorAll('.website-update-kind.translation').length, 2); assert.equal(translated.querySelector('.website-update-kind.new-card, .website-update-kind.new-printing'), null);
  assert.ok([...translated.querySelectorAll('.website-update-kind')].every(badge => badge.textContent === '翻譯更新'));
  assert.match(translated.querySelector('caption').textContent, /翻譯更新卡片（既有卡圖）/); assert.match(translated.querySelector('[role="region"]').getAttribute('aria-label'), /翻譯更新卡片表/);
  assert.match(translated.textContent, /AI 翻譯/); assert.match(translated.textContent, /不代表效果已實作/);
  assert.match(old.querySelector('.website-update-counts').textContent, /新增卡號 22 張/); assert.match(old.querySelector('.website-update-counts').textContent, /57 款（其中 35/);
  assert.equal(old.querySelectorAll('.website-update-kind.new-card').length, 22); assert.equal(old.querySelectorAll('.website-update-kind.new-printing').length, 35);
  assert.equal(document.querySelectorAll('tbody img').length, 59);
  for (const [index, photo] of [...translated.querySelectorAll('tbody img')].entries()) {
    const row = data.entries[0].cards[index]; assert.equal(photo.src, row.image); assert.ok(photo.alt.includes(row.number) && photo.alt.includes(row.name)); assert.equal(photo.getAttribute('loading'), 'lazy');
    assert.equal(photo.parentElement.target, '_blank'); assert.equal(photo.parentElement.rel, 'noopener noreferrer'); assert.equal(photo.parentElement.href, row.image);
  }
});

test('the genuine22-card translation entry renders91fields and79authentic existing pictures alongside unchanged history', async t => {
  const report = JSON.parse(readFileSync('docs/translation-refresh-2026-10-30/log-report.json', 'utf8'));
  const actual = JSON.parse(readFileSync('public/website-updates.json', 'utf8'));
  const id = `translations-${report.translationRevision}-${report.translationSha256.slice(0, 12)}`;
  const translation = actual.entries.find(entry => entry.id === id), history = actual.entries.find(entry => entry.id === legacyHistory.entries[0].id);
  assert.ok(translation); assert.ok(history); assert.deepEqual(translation.counts, { newCards: 0, newPrintings: 0, newPrintingsForExistingCards: 0, translatedCards: 22, translatedFields: 91 });
  const ui = await workspace(t); await ui.open(); await ui.respond({ schemaVersion: 1, entries: [translation, history] });
  const entry = document.querySelector('.website-update-entry');
  assert.match(entry.querySelector('.website-update-counts').textContent, /繁中翻譯 22 個卡號 · 91 個文字欄位/);
  assert.equal(entry.querySelectorAll('tbody tr').length, 22); assert.equal(entry.querySelectorAll('.website-update-kind.translation').length, 22);
  assert.equal(entry.querySelector('.website-update-kind.new-card, .website-update-kind.new-printing'), null);
  assert.equal(document.querySelectorAll('tbody img').length, 79);
  assert.match(entry.textContent, /未經人工覆核/); assert.match(entry.textContent, /僅供顯示/); assert.match(entry.textContent, /不代表效果已實作/);
  assert.doesNotMatch(entry.textContent, /App.*(?:已支援|相容|即時更新)|無須更新APK/);
});

test('mixed translation/history tables preserve keyboard focus, repeated close/reopen and saved storage', async t => {
  const ui = await workspace(t); localStorage.setItem('untouched-deck', 'preserve'); document.body.style.overflow = 'clip';
  await ui.open(); await ui.respond(); const trigger = document.querySelector('.website-update-trigger');
  const first = document.querySelector('.website-update-close'), last = document.querySelector('.website-update-actions button'), dialog = document.querySelector('dialog');
  first.focus(); await ui.event(dialog, new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })); assert.equal(document.activeElement, last);
  await ui.event(dialog, new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); assert.equal(document.activeElement, first);
  await ui.event(dialog, new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); assert.equal(document.querySelector('dialog'), null); assert.equal(document.activeElement, trigger); assert.equal(document.body.style.overflow, 'clip');
  await ui.open(); assert.equal(ui.requests.length, 1, 'mixed payload stays cached for this component lifetime');
  await ui.click(document.querySelector('.website-update-actions button')); await ui.click(trigger); await ui.click(document.querySelector('.website-update-close'));
  assert.equal(document.querySelector('dialog'), null); assert.equal(document.activeElement, trigger); assert.equal(localStorage.getItem('untouched-deck'), 'preserve');
});

for (const [name, mutate] of [
  ['translation classified as a new printing', data => { data.entries[0].cards[0].kind = 'new-printing'; }],
  ['nonzero additions claimed', data => { data.entries[0].counts.newCards = 1; }],
  ['incorrect translated card count', data => { data.entries[0].counts.translatedCards++; }],
  ['missing translation digest', data => { delete data.entries[0].translationSha256; }],
  ['non-string revision', data => { data.entries[0].translationRevision = 20261030; }],
  ['unsafe translation photo', data => { data.entries[0].cards[0].image = 'https://example.invalid/not-official.png'; }],
]) test(`invalid translation log is rejected without rendering photos: ${name}`, async t => {
  const ui = await workspace(t); await ui.open(); const data = payload(); mutate(data); await ui.respond(data);
  assert.ok(document.querySelector('[role="alert"]')); assert.equal(document.querySelector('tbody img'), null);
});
