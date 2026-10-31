import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, unlinkSync } from 'node:fs';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

// DOM and hook tests only; catalog flags, simulator support and network services stay untouched.
const catalog = JSON.parse(readFileSync('public/cards.json', 'utf8'));
const imported = catalog.cards.find(card => card.number === 'hSD20-001');
const reprint = catalog.cards.find(card => card.number === 'hSD14-010');
let bundleIndex = 0;

async function workspace(t, timestamp, { entry = 'home', cards = [imported, reprint] } = {}) {
  const dom = new JSDOM('<button id="before">之前焦點</button><main id="root"></main>', { url: 'https://hololive-ocg.web.app/', pretendToBeVisual: true });
  const keys = ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLDialogElement', 'CustomEvent', 'Event', 'KeyboardEvent', 'MouseEvent', 'localStorage', 'location', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'navigator'];
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: typeof dom.window[key] === 'function' && ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key) ? dom.window[key].bind(dom.window) : dom.window[key] });
  dom.window.matchMedia = query => ({ matches: query.includes('reduced-motion') || query.includes('901px'), media: query, addEventListener() {}, removeEventListener() {} });
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); this.querySelector('button')?.focus(); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const oldFetch = globalThis.fetch, oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT, oldNow = Date.now;
  let now = timestamp;
  Date.now = () => now;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const requests = [], timers = new Map();
  let timerId = 0;
  if (entry === 'clock') {
    dom.window.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; };
    dom.window.clearTimeout = id => timers.delete(id);
  }
  globalThis.fetch = async url => {
    requests.push(String(url));
    if (url === '/cards.json') return Response.json({ ...catalog, cards });
    if (url === '/holosim-card-index.json') return Response.json({});
    throw new Error(`Unexpected network request: ${url}`);
  };
  mkdirSync('work', { recursive: true });
  const outfile = `work/card-release-ui-${process.pid}-${bundleIndex++}.mjs`;
  const contents = entry === 'clock'
    ? `import useJapanDate from './app/useJapanDate'; export default function Clock() { return <output>{useJapanDate()}</output>; }`
    : entry === 'inspector' ? `export { ReleaseTestInspector as default } from './app/simulator/SimulatorClient';` : `export { default } from './app/page';`;
  await build({ stdin: { contents, resolveDir: process.cwd(), loader: 'tsx' }, outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', alias: { '@': process.cwd(), 'next/link': './firebase/Link.tsx' }, define: { 'import.meta.env': JSON.stringify({ VITE_APP_BACKEND: 'firebase' }) }, plugins: [{ name: 'inspect-card-release-presentation', setup(builder) { builder.onLoad({ filter: /SimulatorClient\.tsx$/ }, args => ({ contents: readFileSync(args.path, 'utf8') + '\nexport { CardInspector as ReleaseTestInspector };', loader: 'tsx' })); } }] });
  const { default: Component } = await import(new URL(`../${outfile}`, import.meta.url));
  const { createElement, act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const settle = () => new Promise(resolve => setTimeout(resolve, 25));
  let root = createRoot(document.getElementById('root'));
  const render = async props => { await act(async () => { root.render(createElement(Component, props)); await settle(); }); await act(async () => { await settle(); }); };
  const unmount = async () => { if (root) { await act(async () => root.unmount()); root = null; } };
  const click = async node => { assert.ok(node, 'control exists'); node.focus(); await act(async () => { node.click(); await settle(); }); };
  const focus = async () => { await act(async () => { window.dispatchEvent(new dom.window.Event('focus')); await settle(); }); };
  const visibility = async value => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value });
    await act(async () => { document.dispatchEvent(new dom.window.Event('visibilitychange')); await settle(); });
  };
  const fireTimer = async () => {
    assert.equal(timers.size, 1, 'exactly one next-date check is scheduled');
    const [id, timer] = [...timers][0]; timers.delete(id);
    await act(async () => { timer.callback(); await settle(); });
  };
  t.after(async () => {
    await unmount(); dom.window.close(); unlinkSync(outfile);
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    globalThis.fetch = oldFetch; globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct; Date.now = oldNow;
  });
  return { dom, act, settle, render, unmount, click, focus, visibility, fireTimer, timers, requests, setClock: value => { now = value; } };
}

const tile = id => [...document.querySelectorAll('.card-tile')].find(node => node.dataset.printingId === id);
const currentDialog = () => document.querySelector('dialog[open]');
const dateNotice = dialog => [...dialog.querySelectorAll('[role="note"]')].find(node => /官方先行公開・/.test(node.textContent));
const timestamp = value => Date.parse(value);

test('an open exact-printing reader drops prerelease presentation on the Japan release day without changing manual-effect warnings or storage', async t => {
  const before = JSON.stringify(catalog), variant = imported.variants[0];
  const ui = await workspace(t, timestamp('2026-10-29T14:30:00.000Z'));
  localStorage.setItem('preserved-user-record', '{"printings":"keep"}');
  await ui.render();
  assert.ok(tile(variant.id).querySelector('.preview-ribbon'));
  const reprintVariant = reprint.variants.find(variant => variant.id === 'official-hSD14-010-3042');
  assert.ok(tile(reprintVariant.id).querySelector('.preview-ribbon'));
  for (const sibling of reprint.variants.filter(candidate => candidate.id !== reprintVariant.id)) {
    assert.equal(tile(sibling.id).querySelector('.preview-ribbon'), null, 'a preexisting sibling never inherits the new printing preview');
  }
  const opener = tile(variant.id).querySelector('.card-open');
  await ui.click(opener);
  const dialog = currentDialog(), originalImage = dialog.querySelector('.modal-card-image img').getAttribute('src');
  const warning = dialog.querySelector('[data-card-import-warning]').textContent;
  assert.match(warning, /不適用自動對戰/);
  assert.match(dialog.querySelector('.preview-badge').textContent, /官方先行公開/);
  assert.ok(dateNotice(dialog).textContent.includes('2026-10-30'));
  const draftBefore = localStorage.getItem('holo-account-v1:guest:draft');
  ui.setClock(timestamp('2026-10-29T15:00:00.000Z'));
  await ui.focus();
  assert.equal(currentDialog(), dialog, 'midnight refresh preserves the active reader');
  assert.equal(dialog.dataset.printingId, variant.id);
  assert.equal(dialog.querySelector('.modal-card-image img').getAttribute('src'), originalImage);
  assert.equal(dialog.querySelector('.preview-badge'), null);
  assert.equal(dateNotice(dialog), undefined);
  assert.ok(dialog.querySelector('[data-card-release-date]').textContent.includes('2026-10-30'));
  assert.equal(tile(variant.id).querySelector('.preview-ribbon'), null);
  assert.equal(tile(reprintVariant.id).querySelector('.preview-ribbon'), null);
  assert.equal(dialog.querySelector('[data-card-import-warning]').textContent, warning);
  assert.equal(localStorage.getItem('holo-account-v1:guest:draft'), draftBefore);
  assert.equal(localStorage.getItem('preserved-user-record'), '{"printings":"keep"}');
  assert.equal(JSON.stringify(catalog), before, 'presentation does not rewrite source preview flags');
  assert.ok(ui.requests.every(url => url === '/cards.json' || url === '/holosim-card-index.json'));
});

test('released, future, metadata-free and HoloSim printings keep their own presentation without sibling or parent flag bleed', async t => {
  const mixed = structuredClone(imported);
  mixed.number = 'hTEST-001'; mixed.id = 'release-test-card'; mixed.preview = true; mixed.releaseDate = '2026-11-30';
  mixed.variants = [
    { ...structuredClone(imported.variants[0]), id: 'release-test-past', releaseDate: '2026-10-30' },
    { ...structuredClone(imported.variants[0]), id: 'release-test-future', releaseDate: '2026-11-30' },
    { id: 'release-test-no-metadata', rarity: 'C', image: imported.image },
  ];
  const sim = structuredClone(mixed);
  sim.number = 'hTEST-002'; sim.id = 'release-test-sim-card'; delete sim.officialImportSchema;
  sim.variants = [{ id: 'release-test-sim-printing', rarity: 'C', image: imported.image, preview: true, releaseDate: '2020-01-01' }];
  const ui = await workspace(t, timestamp('2026-10-31T03:00:00.000Z'), { cards: [mixed, sim, reprint] });
  await ui.render();
  assert.equal(tile('release-test-past').querySelector('.preview-ribbon'), null);
  assert.ok(tile('release-test-future').querySelector('.preview-ribbon'));
  assert.equal(tile('release-test-no-metadata').querySelector('.preview-ribbon'), null);
  assert.ok(tile('release-test-sim-printing').querySelector('.preview-ribbon'), 'nonofficial simulator preview survives an old release date');
  assert.equal(tile('official-hSD14-010-3042').querySelector('.preview-ribbon'), null, 'the real October30 printing is released on October31');
  await ui.click(tile('release-test-future').querySelector('.card-open'));
  assert.match(currentDialog().querySelector('.preview-badge').textContent, /官方先行公開/);
  assert.ok(dateNotice(currentDialog()).textContent.includes('2026-11-30'));
  const warning = currentDialog().querySelector('[data-card-import-warning]').textContent;
  await ui.click(currentDialog().querySelector('.modal-close'));
  await ui.click(tile('release-test-past').querySelector('.card-open'));
  assert.equal(currentDialog().querySelector('.preview-badge'), null);
  assert.equal(dateNotice(currentDialog()), undefined);
  assert.equal(currentDialog().querySelector('[data-card-import-warning]').textContent, warning);
  await ui.click(currentDialog().querySelector('.modal-close'));
  await ui.click(tile('release-test-no-metadata').querySelector('.card-open'));
  assert.equal(currentDialog().querySelector('.preview-badge'), null, 'an exact variant with no preview metadata does not inherit its official parent flags');
  assert.equal(dateNotice(currentDialog()), undefined);
  await ui.click(currentDialog().querySelector('.modal-close'));
  await ui.click(tile('release-test-sim-printing').querySelector('.card-open'));
  assert.match(currentDialog().querySelector('.preview-badge').textContent, /HoloSim 先行卡/);
  assert.equal(dateNotice(currentDialog()), undefined);
  await ui.click(currentDialog().querySelector('.modal-close'));
  ui.setClock(timestamp('2026-11-30T15:00:00.000Z'));
  await ui.visibility('visible');
  assert.equal(tile('release-test-future').querySelector('.preview-ribbon'), null);
  await ui.click(tile('release-test-future').querySelector('.card-open'));
  assert.equal(currentDialog().querySelector('.preview-badge'), null);
  assert.equal(dateNotice(currentDialog()), undefined);
  assert.equal(currentDialog().querySelector('[data-card-import-warning]').textContent, warning);
});

test('Japan date hook refreshes at midnight and on resume, keeps one bounded timer and cleans up listeners and timers', async t => {
  const ui = await workspace(t, timestamp('2026-10-29T14:59:59.999Z'), { entry: 'clock' });
  await ui.render();
  assert.equal(document.querySelector('output').textContent, '2026-10-29');
  assert.equal(ui.timers.size, 1);
  assert.equal([...ui.timers.values()][0].delay, 26, 'one millisecond to JST midnight plus the clock-boundary margin');
  ui.setClock(timestamp('2026-10-29T15:00:00.025Z'));
  await ui.fireTimer();
  assert.equal(document.querySelector('output').textContent, '2026-10-30');
  assert.equal(ui.timers.size, 1);
  assert.equal([...ui.timers.values()][0].delay, 60 * 60 * 1000);
  const scheduled = [...ui.timers.keys()];
  ui.setClock(timestamp('2026-10-30T15:00:00.000Z'));
  await ui.visibility('hidden');
  assert.equal(document.querySelector('output').textContent, '2026-10-30');
  assert.deepEqual([...ui.timers.keys()], scheduled, 'a hidden-document notification does not create another timer');
  await ui.visibility('visible');
  assert.equal(document.querySelector('output').textContent, '2026-10-31');
  assert.equal(ui.timers.size, 1);
  ui.setClock(timestamp('2026-11-01T00:00:00.000Z'));
  await ui.focus();
  assert.equal(document.querySelector('output').textContent, '2026-11-01');
  assert.equal(ui.timers.size, 1);
  ui.setClock(Number.NaN); await ui.focus();
  assert.equal(document.querySelector('output').textContent, '');
  assert.equal([...ui.timers.values()][0].delay, 60 * 60 * 1000, 'an invalid device clock remains conservatively recheckable');
  ui.setClock(timestamp('2026-11-02T00:00:00.000Z')); await ui.focus();
  assert.equal(document.querySelector('output').textContent, '2026-11-02');
  await ui.unmount();
  assert.equal(ui.timers.size, 0);
  await ui.focus(); await ui.visibility('visible');
  assert.equal(ui.timers.size, 0, 'unmounted hook removes focus and visibility listeners');
});


test('the actual simulator inspector updates only release presentation while preserving exact artwork, manual-effect warnings and support status', async t => {
  const variant = imported.variants[0], cardMap = new Map([imported, reprint].map(card => [card.number, card]));
  const ui = await workspace(t, timestamp('2026-10-29T14:30:00.000Z'), { entry: 'inspector' });
  const battle = '{"room":"preserved","variantId":"' + variant.id + '"}';
  localStorage.setItem('saved-battle-reference', battle);
  await ui.render({ card: imported, cardMap, variantId: variant.id });
  const inspector = document.querySelector('.sim-card-inspector');
  const warning = inspector.querySelector('[data-card-import-warning]').textContent;
  const support = inspector.querySelector('.sim-inspector-head .pending').textContent;
  assert.match(warning, /不適用自動對戰/);
  assert.ok(dateNotice(inspector).textContent.includes('2026-10-30'));
  assert.equal(inspector.querySelector('[data-card-release-date]'), null);
  assert.equal(inspector.querySelector('.sim-inspector-art img').getAttribute('src'), variant.image);
  assert.equal(inspector.querySelector('.sim-inspector-head code').textContent, `${imported.number} · ${variant.rarity}`);
  ui.setClock(timestamp('2026-10-29T15:00:00.000Z')); await ui.focus();
  assert.equal(document.querySelector('.sim-card-inspector'), inspector);
  assert.equal(dateNotice(inspector), undefined);
  assert.ok(inspector.querySelector('[data-card-release-date]').textContent.includes('2026-10-30'));
  assert.equal(inspector.querySelector('[data-card-import-warning]').textContent, warning);
  assert.equal(inspector.querySelector('.sim-inspector-head .pending').textContent, support);
  assert.equal(inspector.querySelector('.sim-inspector-head .automated'), null, 'a released printing does not gain implemented effects');
  assert.equal(inspector.querySelector('.sim-inspector-art img').getAttribute('src'), variant.image);
  ui.setClock(timestamp('2026-10-31T03:00:00.000Z')); await ui.visibility('visible');
  assert.equal(dateNotice(inspector), undefined);
  assert.equal(inspector.querySelector('[data-card-import-warning]').textContent, warning);
  assert.equal(localStorage.getItem('saved-battle-reference'), battle);
  assert.equal(ui.requests.length, 0, 'reading a release status never invokes a battle or backend action');
});
