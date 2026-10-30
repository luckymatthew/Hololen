import { restoreTranslationBaseline } from './translation-preservation-helpers.mjs';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import test from 'node:test';

const payload = JSON.parse(restoreTranslationBaseline('website/public/website-updates.json', readFileSync('public/website-updates.json', 'utf8')));
let bundleIndex = 0;
async function workspace(t) {
  const dom = new JSDOM('<button id="before">之前焦點</button><main id="root"></main>', { url: 'https://hololive-ocg.web.app/cards', pretendToBeVisual: true });
  const globals = ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Event', 'KeyboardEvent', 'PopStateEvent', 'HashChangeEvent', 'localStorage', 'location'];
  const previous = new Map(globals.map(key => [key, globalThis[key]]));
  for (const key of globals) globalThis[key] = dom.window[key];
  const previousFetch = globalThis.fetch, previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.matchMedia = query => ({ matches: query.includes('prefers-reduced-motion'), media: query, addEventListener() {}, removeEventListener() {} });
  let shown = 0;
  dom.window.HTMLDialogElement.prototype.showModal = function () { assert.equal(this.open, false, 'never call showModal twice for one opening'); shown++; this.setAttribute('open', ''); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const requests = [];
  globalThis.fetch = (url, options = {}) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject }));
  mkdirSync('work', { recursive: true });
  const outfile = `work/website-update-log-test-${process.pid}-${bundleIndex++}.mjs`;
  await build({ entryPoints: ['app/WebsiteUpdateLog.tsx'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic' });
  const { default: WebsiteUpdateLog } = await import(new URL(`../${outfile}`, import.meta.url));
  const { createElement, act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  let root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(createElement(WebsiteUpdateLog)); });
  const trigger = () => document.querySelector('.website-update-trigger');
  const dialog = () => document.querySelector('dialog');
  const settle = () => new Promise(resolve => setTimeout(resolve, 25));
  const open = async () => { trigger().focus(); await act(async () => { trigger().click(); await settle(); }); };
  const click = async element => { await act(async () => { element.click(); await settle(); }); };
  const event = async (element, e) => { await act(async () => { element.dispatchEvent(e); await settle(); }); };
  const respond = async (index, body = payload, status = 200) => { await act(async () => { requests[index].resolve(Response.json(body, { status })); }); };
  t.after(async () => {
    if (root) await act(async () => root.unmount());
    dom.window.close(); unlinkSync(outfile);
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
    globalThis.fetch = previousFetch; globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
  });
  return { dom, requests, trigger, dialog, open, click, event, respond, act, shown: () => shown, unmount: async () => { await act(async () => root.unmount()); root = null; } };
}

test('footer mounts once in shared Firebase shell, without routing/auth/deck or match overlay changes', () => {
  const source = readFileSync('firebase/main.tsx', 'utf8'), styles = readFileSync('app/globals.css', 'utf8');
  assert.equal(source.match(/<WebsiteUpdateLog \/>/g)?.length, 1);
  assert.match(source, /<Suspense[^]*>\{page\}<\/Suspense><\/PageBoundary><WebsiteUpdateLog \/>/);
  assert.ok(!readFileSync('app/WebsiteUpdateLog.tsx', 'utf8').includes('history.pushState'));
  const footerRules = [...styles.matchAll(/\.website-update-footer\s*\{([^}]+)\}/g)].map(match => match[1]);
  assert.equal(footerRules.length, 1); assert.ok(!footerRules.some(rule => /position:\s*(fixed|absolute)/.test(rule)));
});

test('opens on demand, renders only authentic current rows/photos, and reopens from cache without duplicate dialogs', async t => {
  const ui = await workspace(t), originalHistory = window.history.length;
  assert.equal(ui.requests.length, 0); assert.equal(ui.dialog(), null);
  assert.equal(ui.trigger().textContent, '更新紀錄'); assert.equal(ui.trigger().getAttribute('aria-expanded'), 'false');
  document.body.style.overflow = 'clip'; localStorage.setItem('unrelated-saved-deck', '{"preserve":true}');
  await ui.open(); await ui.click(ui.trigger()); await ui.click(ui.trigger());
  assert.equal(ui.shown(), 1); assert.equal(document.querySelectorAll('dialog').length, 1); assert.equal(ui.requests.length, 1);
  assert.equal(ui.requests[0].url, '/website-updates.json'); assert.equal(ui.requests[0].options.cache, 'no-cache');
  assert.equal(document.body.style.overflow, 'hidden'); assert.equal(document.activeElement.getAttribute('aria-label'), '關閉更新紀錄');
  assert.equal(ui.dialog().getAttribute('aria-modal'), 'true'); assert.ok(document.getElementById(ui.dialog().getAttribute('aria-labelledby')));
  assert.match(ui.dialog().textContent, /正在載入/);
  await ui.respond(0);
  const rows = [...document.querySelectorAll('tbody tr')], photos = [...document.querySelectorAll('tbody img')];
  assert.equal(rows.length, 57); assert.equal(photos.length, 57); assert.equal(document.querySelectorAll('.website-update-entry').length, 1);
  assert.equal(document.querySelectorAll('.website-update-kind.new-card').length, 22); assert.equal(document.querySelectorAll('.website-update-kind.new-printing').length, 35);
  assert.equal(document.querySelector('time').dateTime, payload.entries[0].date);
  assert.match(document.querySelector('.website-update-counts').textContent, /新增卡號 22 張/);
  assert.match(document.querySelector('.website-update-counts').textContent, /57 款（其中 35/);
  for (const [index, photo] of photos.entries()) {
    const card = payload.entries[0].cards[index];
    assert.equal(photo.src, card.image); assert.equal(photo.getAttribute('loading'), 'lazy'); assert.equal(photo.getAttribute('decoding'), 'async');
    assert.ok(photo.alt.includes(card.number) && photo.alt.includes(card.name)); assert.equal(photo.parentElement.href, card.image);
    assert.equal(photo.parentElement.rel, 'noopener noreferrer'); assert.equal(photo.parentElement.target, '_blank');
    assert.ok(rows[index].textContent.includes(card.number)); assert.ok(rows[index].textContent.includes(card.name));
  }
  assert.match(document.querySelector('table caption').textContent, /新增卡圖明細/);
  assert.equal(document.querySelectorAll('thead th[scope="col"]').length, 5);
  assert.ok([...document.querySelectorAll('tbody tr')].find(row => row.textContent.includes('hSD14-010')).textContent.includes('先行公開'));
  await ui.click(document.querySelector('.website-update-actions button'));
  assert.equal(ui.dialog(), null); assert.equal(document.body.style.overflow, 'clip'); assert.equal(document.activeElement, ui.trigger());
  await ui.open(); assert.equal(ui.requests.length, 1); assert.equal(ui.shown(), 2); assert.equal(document.querySelectorAll('tbody tr').length, 57);
  await ui.click(document.querySelector('.website-update-close'));
  assert.equal(ui.dialog(), null); assert.equal(window.history.length, originalHistory); assert.equal(location.pathname, '/cards');
  assert.equal(localStorage.getItem('unrelated-saved-deck'), '{"preserve":true}');
});

test('keyboard focus remains in dialog; Escape/native cancel/backdrop and browser navigation close with focus restoration', async t => {
  const ui = await workspace(t);
  await ui.open(); await ui.respond(0);
  const first = document.querySelector('.website-update-close'), last = document.querySelector('.website-update-actions button');
  first.focus(); await ui.event(ui.dialog(), new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })); assert.equal(document.activeElement, last);
  await ui.event(ui.dialog(), new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); assert.equal(document.activeElement, first);
  document.getElementById('before').focus(); await ui.event(ui.dialog(), new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); assert.equal(document.activeElement, first);
  await ui.event(ui.dialog(), new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(ui.dialog(), null); assert.equal(document.activeElement, ui.trigger());
  await ui.open(); const cancel = new Event('cancel', { bubbles: true, cancelable: true }); await ui.event(ui.dialog(), cancel);
  assert.equal(cancel.defaultPrevented, true); assert.equal(ui.dialog(), null); assert.equal(document.activeElement, ui.trigger());
  await ui.open(); await ui.click(document.querySelector('.website-update-entry h3')); assert.ok(ui.dialog()); await ui.click(ui.dialog()); assert.equal(ui.dialog(), null);
  await ui.open(); const beforeLength = window.history.length; await ui.event(window, new PopStateEvent('popstate')); assert.equal(ui.dialog(), null); assert.equal(window.history.length, beforeLength);
  await ui.open(); await ui.event(window, new HashChangeEvent('hashchange')); assert.equal(ui.dialog(), null);
  await ui.open(); await ui.event(ui.dialog(), new Event('close')); assert.equal(ui.dialog(), null);
});

test('failed or malformed data has a recoverable retry; unsafe photos never render', async t => {
  const ui = await workspace(t); await ui.open(); await ui.respond(0, {}, 503);
  assert.match(document.querySelector('[role="alert"]').textContent, /暫時無法載入/);
  await ui.click(document.querySelector('[role="alert"] button'));
  assert.equal(ui.requests.length, 2); assert.match(ui.dialog().textContent, /正在載入/);
  const unsafe = structuredClone(payload); unsafe.entries[0].cards[0].image = 'https://example.com/not-official.png'; await ui.respond(1, unsafe);
  assert.ok(document.querySelector('[role="alert"]')); assert.equal(document.querySelector('tbody img'), null);
  await ui.click(document.querySelector('[role="alert"] button')); await ui.respond(2);
  assert.equal(document.querySelectorAll('tbody tr').length, 57); assert.equal(document.querySelector('[role="alert"]'), null);
});

test('closing during load aborts it, stale responses cannot replace reopened content, and unmount restores focus/scroll', async t => {
  const ui = await workspace(t); document.body.style.overflow = 'auto'; await ui.open();
  const original = ui.requests[0]; await ui.click(document.querySelector('.website-update-close'));
  assert.equal(original.options.signal.aborted, true); assert.equal(document.body.style.overflow, 'auto');
  await ui.open(); assert.equal(ui.requests.length, 2);
  const stale = structuredClone(payload); stale.entries[0].title = 'STALE RESPONSE'; await ui.respond(0, stale);
  assert.ok(!ui.dialog().textContent.includes('STALE RESPONSE')); assert.match(ui.dialog().textContent, /正在載入/);
  await ui.respond(1); assert.equal(document.querySelectorAll('tbody tr').length, 57);
  await ui.unmount(); assert.equal(document.querySelector('dialog'), null); assert.equal(document.body.style.overflow, 'auto');
  assert.ok(document.activeElement === document.body || document.activeElement.isConnected);
});

test('an empty verified history is explicit rather than inventing older releases', async t => {
  const ui = await workspace(t); await ui.open(); await ui.respond(0, { schemaVersion: 1, entries: [] });
  assert.match(ui.dialog().textContent, /尚未有已核實/); assert.equal(document.querySelector('table'), null);
});
