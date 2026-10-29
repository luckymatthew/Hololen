import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import test from 'node:test';

let bundleIndex = 0;
async function workspace(t, entry = 'motion', reduced = true) {
  const dom = new JSDOM('<button id="before">之前焦點</button><main id="root"></main>', { url: 'https://hololive-ocg.web.app/', pretendToBeVisual: true });
  const keys = ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Event', 'KeyboardEvent', 'MouseEvent', 'localStorage', 'location', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'navigator'];
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: typeof dom.window[key] === 'function' && ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key) ? dom.window[key].bind(dom.window) : dom.window[key] });
  dom.window.matchMedia = query => ({ matches: (query.includes('reduced-motion') && reduced) || query.includes('901px'), media: query, addEventListener() {}, removeEventListener() {} });
  let shown = 0;
  dom.window.HTMLDialogElement.prototype.showModal = function () { assert.equal(this.open, false); shown++; this.setAttribute('open', ''); this.querySelector('button')?.focus(); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const oldFetch = globalThis.fetch, oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const catalog = JSON.parse(readFileSync('public/cards.json', 'utf8'));
  globalThis.fetch = async url => Response.json(String(url).includes('cards.json') ? catalog : {});
  mkdirSync('work', { recursive: true });
  const outfile = `work/ui-redesign-${process.pid}-${bundleIndex++}.mjs`;
  const contents = entry === 'home' ? `export { default as Home } from './app/page';` : `export * from './app/ui-motion';`;
  await build({ stdin: { contents, resolveDir: process.cwd(), loader: 'tsx' }, outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', alias: { '@': process.cwd(), 'next/link': './firebase/Link.tsx' }, define: { 'import.meta.env': JSON.stringify({ VITE_APP_BACKEND: 'firebase' }) } });
  const components = await import(new URL(`../${outfile}`, import.meta.url));
  const { createElement: h, act, useState } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  const settle = () => new Promise(resolve => setTimeout(resolve, 35));
  const render = async node => { await act(async () => { root.render(node); await settle(); }); };
  const click = async node => { assert.ok(node, 'control exists'); node.focus(); await act(async () => { node.click(); await settle(); }); };
  const input = async (node, value) => { await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(node, value); node.dispatchEvent(new dom.window.Event('input', { bubbles: true })); await settle(); }); };
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); unlinkSync(outfile); for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } globalThis.fetch = oldFetch; globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct; });
  return { dom, module: components, h, act, useState, root, render, click, input, settle, shown: () => shown };
}

test('native modal opens once, repeated dismissal is safe, restores focus/overflow and never changes storage', async t => {
  const ui = await workspace(t), { h, useState, module: { useModalMotion } } = ui;
  let closed = 0;
  function Modal({ close }) { const { dialog, requestClose } = useModalMotion(close); return h('dialog', { ref: dialog, className: 't-modal', onCancel: e => { e.preventDefault(); requestClose(); } }, h('button', { onClick: requestClose }, '關閉')); }
  function Harness() { const [open, setOpen] = useState(false); return h('div', null, h('button', { id: 'launch', onClick: () => setOpen(true) }, '開啟'), open && h(Modal, { close: () => { closed++; setOpen(false); } })); }
  localStorage.setItem('preserved', '{"deck":true}'); document.body.style.overflow = 'clip';
  await ui.render(h(Harness)); await ui.click(document.getElementById('launch'));
  assert.equal(ui.shown(), 1); assert.equal(document.body.style.overflow, 'hidden');
  await ui.act(async () => { const close = document.querySelector('dialog button'); close.click(); close.click(); await ui.settle(); });
  assert.equal(closed, 1); assert.equal(document.querySelector('dialog'), null); assert.equal(document.activeElement.id, 'launch'); assert.equal(document.body.style.overflow, 'clip');
  assert.equal(localStorage.getItem('preserved'), '{"deck":true}');
  await ui.click(document.getElementById('launch')); assert.equal(ui.shown(), 2);
});

test('segmented controls retain pressed semantics and readable status toasts under reduced motion', async t => {
  const ui = await workspace(t), { h, useState, module: { SlidingTabs, StatusToast } } = ui;
  function Harness() { const [value, set] = useState('a'); return h('div', null, h(SlidingTabs, { label: '卡片種類', selected: value }, ['a', 'b'].map(v => h('button', { key: v, 'aria-pressed': value === v, onClick: () => set(v) }, v))), h(StatusToast, { message: value === 'a' ? '' : '已保存' })); }
  await ui.render(h(Harness)); await ui.click(document.querySelectorAll('.t-tabs button')[1]);
  assert.equal(document.querySelectorAll('[aria-pressed="true"]').length, 1); assert.equal(document.querySelector('[aria-pressed="true"]').textContent, 'b');
  assert.equal(document.querySelector('[role="status"]').textContent, '已保存');
});

test('current library keeps search/filter/view/printing editing and deck navigation functional with isolated storage', async t => {
  const ui = await workspace(t, 'home');
  localStorage.setItem('unrelated-saved-deck', 'do-not-touch');
  await ui.render(ui.h(ui.module.Home));
  await ui.act(async () => { await ui.settle(); });
  assert.equal(document.querySelectorAll('.card-tile').length, 72);
  assert.equal(document.querySelector('.catalog-layout').dataset.filtersOpen, 'true');
  await ui.input(document.querySelector('input[type="search"]'), 'hBP01-001');
  assert.equal(document.querySelectorAll('.card-tile').length, 1);
  assert.match(document.querySelector('.card-meta code').textContent, /hBP01-001/);
  await ui.click(document.querySelector('[aria-label="效果列表模式"]'));
  assert.ok(document.querySelector('.studio-list')); assert.equal(document.querySelector('[aria-label="效果列表模式"]').getAttribute('aria-pressed'), 'true');
  const opener = document.querySelector('.card-open'); await ui.click(opener);
  assert.equal(document.querySelectorAll('dialog').length, 1);
  const variants = [...document.querySelectorAll('.variant-strip button')]; assert.ok(variants.length > 1);
  const variant = variants.at(-1); await ui.click(variant); assert.equal(variant.getAttribute('aria-pressed'), 'true');
  await ui.click(document.querySelector('.add-large'));
  assert.match(document.querySelector('.modal-quantity-controls output').textContent, /合計 1 張/);
  await ui.click(document.querySelector('.modal-close')); assert.equal(document.activeElement, opener);
  await ui.click(document.querySelectorAll('.studio-navigation button')[1]); assert.equal(document.getElementById('deck-workbench').hidden, false);
  assert.equal(document.getElementById('library').hidden, true); assert.equal(document.querySelectorAll('.deck-card-tile').length, 1);
  await ui.click(document.querySelector('.clear-button')); assert.ok(document.querySelector('.deck-confirm-dialog'));
  await ui.click(document.querySelector('.deck-confirm-dialog button')); assert.equal(document.querySelectorAll('.deck-card-tile').length, 1, 'cancel never clears draft');
  assert.equal(localStorage.getItem('unrelated-saved-deck'), 'do-not-touch');
});

test('motion and semantic theme tokens cover reduced motion, hidden filters, native controls and all application surfaces', () => {
  const css = readFileSync('app/design-system.css', 'utf8'), motion = readFileSync('app/motion.css', 'utf8'), main = readFileSync('firebase/main.tsx', 'utf8');
  for (const selector of ['.studio-header', '.catalog-filter-rail', '.deck-workbench', '.studio-card-dialog', '.scanner-dialog', '.account-page', '.download-page', '.sim-room-card', '.sim-log', '.sim-inspector', '.website-update-dialog', '.page-error']) assert.ok(css.includes(selector), selector);
  for (const selector of ['.t-modal.is-closing', '.t-tabs-pill', '.t-acc-panel-inner', '.t-toast.is-open', 'prefers-reduced-motion']) assert.ok(motion.includes(selector), selector);
  assert.ok(css.includes(':focus-visible')); assert.ok(css.includes(":root[data-theme='dark']")); assert.ok(css.includes('prefers-color-scheme: dark'));
  assert.doesNotMatch(motion, /transition:\s*all\b/);
  assert.match(readFileSync('app/page.tsx', 'utf8'), /id="advanced-filters" inert=\{!filtersOpen\}/);
  assert.match(readFileSync('app/simulator/SimulatorClient.tsx', 'utf8'), /aria-label="私人房間代碼（6 個字元）"/);
  assert.ok(main.includes('PageBoundary')); assert.ok(main.includes('PageLoading')); assert.ok(main.includes('registration.waiting'));
});


test('normal motion retains the modal during its 150ms exit, cancels delayed work on unmount and retains toast text through its exit', async t => {
  const ui = await workspace(t, 'motion', false), { h, useState, module: { useModalMotion, StatusToast } } = ui;
  document.documentElement.style.setProperty('--modal-close-dur', '150ms');
  document.documentElement.style.setProperty('--toast-close', '250ms');
  let closed = 0;
  function Modal({ close }) { const { dialog, requestClose } = useModalMotion(close); return h('dialog', { ref: dialog, className: 't-modal' }, h('button', { onClick: requestClose }, '關閉')); }
  function Harness() { const [open, setOpen] = useState(false); return h('div', null, h('button', { id: 'launch', onClick: () => setOpen(true) }, '開啟'), open && h(Modal, { close: () => { closed++; setOpen(false); } })); }
  await ui.render(h(Harness)); await ui.click(document.getElementById('launch'));
  await ui.click(document.querySelector('dialog button'));
  assert.ok(document.querySelector('dialog.is-closing')); assert.equal(document.querySelector('dialog').inert, true, 'closing actions are inert to keyboard/pointer activation'); assert.equal(closed, 0);
  await ui.act(async () => { document.querySelector('dialog button').click(); await new Promise(resolve => setTimeout(resolve, 180)); });
  assert.equal(closed, 1); assert.equal(document.querySelector('dialog'), null); assert.equal(document.activeElement.id, 'launch');
  await ui.click(document.getElementById('launch')); await ui.click(document.querySelector('dialog button'));
  await ui.render(h('p', null, 'new view')); await ui.act(async () => { await new Promise(resolve => setTimeout(resolve, 180)); });
  assert.equal(closed, 1, 'unmounted modal cannot call a stale close handler'); assert.equal(document.body.style.overflow, '');
  await ui.render(h(StatusToast, { message: '已保存' })); await ui.act(async () => { await ui.settle(); }); await ui.render(h(StatusToast, { message: '' })); await ui.act(async () => { await ui.settle(); });
  assert.equal(document.querySelector('.toast').textContent, '已保存'); assert.equal(document.querySelector('.toast').classList.contains('is-open'), false);
  await ui.act(async () => { await new Promise(resolve => setTimeout(resolve, 280)); }); assert.equal(document.querySelector('.toast'), null);
});
