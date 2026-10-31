import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, unlinkSync } from 'node:fs';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

// Real catalog component tests. No browser, Firebase service or retailer requests.
const catalog = JSON.parse(readFileSync('public/cards.json', 'utf8'));
const simIndex = JSON.parse(readFileSync('public/holosim-card-index.json', 'utf8'));
const lami = catalog.cards.find(card => card.number === 'hBP09-079');
const restricted = catalog.cards.find(card => card.number === 'hBP01-030');
const supportedOshi = catalog.cards.find(card => card.group === 'oshi' && simIndex[card.number]?.length);
let bundleIndex = 0;

async function workspace(t, initialDeck) {
  const dom = new JSDOM('<button id="before">之前焦點</button><main id="root"></main>', { url: 'https://hololive-ocg.web.app/', pretendToBeVisual: true });
  const keys = ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLDialogElement', 'CustomEvent', 'Event', 'KeyboardEvent', 'MouseEvent', 'localStorage', 'location', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'navigator'];
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: typeof dom.window[key] === 'function' && ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key) ? dom.window[key].bind(dom.window) : dom.window[key] });
  dom.window.matchMedia = query => ({ matches: query.includes('reduced-motion') || query.includes('901px'), media: query, addEventListener() {}, removeEventListener() {} });
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); this.querySelector('button')?.focus(); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const oldFetch = globalThis.fetch, oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const requests = [];
  globalThis.fetch = async url => {
    requests.push(String(url));
    if (url === '/cards.json') return Response.json(catalog);
    if (url === '/holosim-card-index.json') return Response.json(simIndex);
    throw new Error(`Unexpected network request: ${url}`);
  };
  mkdirSync('work', { recursive: true });
  const outfile = `work/printing-catalog-${process.pid}-${bundleIndex++}.mjs`;
  await build({ stdin: { contents: `export { default as Home } from './app/page'; export * as store from './lib/firebase/store';`, resolveDir: process.cwd(), loader: 'tsx' }, outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', alias: { '@': process.cwd(), 'next/link': './firebase/Link.tsx' }, define: { 'import.meta.env': JSON.stringify({ VITE_APP_BACKEND: 'firebase' }) } });
  const { Home, store } = await import(new URL(`../${outfile}`, import.meta.url));
  const { createElement, act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  if (initialDeck) localStorage.setItem(store.draftKey(), JSON.stringify(initialDeck));
  let root;
  const settle = () => new Promise(resolve => setTimeout(resolve, 25));
  const mount = async (url = '/') => {
    if (root) await act(async () => root.unmount());
    window.history.replaceState({}, '', url);
    root = createRoot(document.getElementById('root'));
    await act(async () => { root.render(createElement(Home)); await settle(); });
    await act(async () => { await settle(); });
  };
  const click = async node => { assert.ok(node, 'control exists'); node.focus(); await act(async () => { node.click(); await settle(); }); };
  const input = async (node, value) => { assert.ok(node, 'input exists'); await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(node, value); node.dispatchEvent(new dom.window.Event('input', { bubbles: true })); await settle(); }); };
  const select = async (node, value) => { assert.ok(node, 'select exists'); await act(async () => { node.value = value; node.dispatchEvent(new dom.window.Event('change', { bubbles: true })); await settle(); }); };
  const importJson = async value => {
    const file = { name: 'printing-roundtrip.json', size: JSON.stringify(value).length, text: async () => JSON.stringify(value) };
    const node = document.querySelector('.import-button input');
    Object.defineProperty(node, 'files', { configurable: true, value: [file] });
    await act(async () => { node.dispatchEvent(new dom.window.Event('change', { bubbles: true })); await settle(); });
  };
  t.after(async () => {
    if (root) await act(async () => root.unmount());
    dom.window.close(); unlinkSync(outfile);
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    globalThis.fetch = oldFetch; globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct;
  });
  const draft = () => JSON.parse(localStorage.getItem(store.draftKey()));
  return { dom, store, act, settle, mount, click, input, select, importJson, draft, requests };
}

const tiles = () => [...document.querySelectorAll('.card-tile')];
const tile = id => tiles().find(node => node.dataset.printingId === id);
const quantity = id => Number(tile(id)?.querySelector('output')?.textContent);
const add = id => tile(id)?.querySelector('.quick-add');
const minus = id => tile(id)?.querySelector('.catalog-quantity-controls button');
const search = ui => value => ui.input(document.querySelector('input[type="search"]'), value);
const result = () => document.querySelector('.result-bar [role="status"]').textContent.replaceAll(',', '');

test('catalog pagination counts real printings plus imageless entries and resets after searching, filtering and sorting', async t => {
  assert.equal(catalog.cards.length, 1416);
  assert.equal(catalog.cards.reduce((sum, card) => sum + card.variants.length, 0), 3038);
  assert.equal(catalog.cards.filter(card => card.variants.length === 0).length, 7);
  const ui = await workspace(t); await ui.mount();
  assert.match(result(), /3038\s*款卡圖/);
  assert.match(result(), /7\s*張未有卡圖/);
  assert.equal(tiles().length, 72);
  assert.equal(new Set(tiles().map(node => `${node.dataset.cardNumber}:${node.dataset.printingId}`)).size, 72);
  await ui.click(document.querySelector('.load-more'));
  assert.equal(tiles().length, 144);
  assert.match(document.querySelector('.load-more').textContent.replaceAll(',', ''), /144\s*\/\s*3045/);
  await search(ui)('hBP09-079');
  assert.equal(tiles().length, 2);
  assert.match(result(), /^2\s*款卡圖/);
  assert.deepEqual(tiles().map(node => node.dataset.printingId), ['hbp09-hBP09-079_C', 'hbp09-hBP09-079_S']);
  await ui.click(document.querySelector('[aria-label="效果列表模式"]'));
  assert.ok(document.querySelector('.studio-list'));
  assert.equal(tiles().length, 2);
  const label = text => [...document.querySelectorAll('.filter-grid label')].find(node => node.querySelector('span')?.textContent === text)?.querySelector('select');
  await ui.select(label('顏色'), 'blue'); assert.equal(tiles().length, 0);
  await ui.select(label('顏色'), 'yellow'); assert.equal(tiles().length, 2);
  await ui.select(label('階級'), '2nd'); assert.equal(tiles().length, 0);
  await ui.select(label('階級'), '1st'); assert.equal(tiles().length, 2);
  await ui.select(label('系列'), 'hBP01'); assert.equal(tiles().length, 0);
  await ui.select(label('系列'), 'hBP09'); assert.equal(tiles().length, 2);
  await ui.select(label('成員（依分部・世代）'), lami.jpName); assert.equal(tiles().length, 2);
  await ui.click(document.querySelector('.filter-rail-heading button'));
  assert.equal(tiles().length, 72, 'clearing filters starts at the first printing page');
  await ui.click(document.querySelector('.load-more'));
  await ui.select(document.querySelector('.result-controls select'), 'name');
  assert.equal(tiles().length, 72, 'sort changes reset printing pagination');
  await search(ui)('hbp09-hBP09-079_S');
  assert.equal(tiles().length, 1, 'a stable printing ID finds only that printing');
  assert.equal(tiles()[0].dataset.printingId, 'hbp09-hBP09-079_S');
  const fallback = catalog.cards.find(card => card.variants.length === 0);
  await ui.click(document.querySelector('.filter-rail-heading button'));
  await search(ui)(fallback.number);
  assert.equal(tiles().length, 1, 'an imageless canonical card is still independently browsable');
  assert.equal(tiles()[0].dataset.cardNumber, fallback.number);
  assert.match(result(), /1\s*張未有卡圖/);
});

test('C and S are independent entries with exact artwork, details, foil and quantity controls', async t => {
  const ui = await workspace(t); await ui.mount(); await search(ui)(lami.number);
  localStorage.setItem('unrelated-deck', 'unchanged');
  assert.equal(tiles().length, 2);
  const labels = tiles().map(node => node.querySelector('.card-open').getAttribute('aria-label'));
  assert.equal(new Set(labels).size, 2, 'each artwork has a distinct accessible detail name');
  for (const variant of lami.variants) {
    const node = tile(variant.id), opener = node.querySelector('.card-open');
    assert.equal(node.dataset.cardNumber, lami.number);
    assert.equal(node.querySelector('.card-thumb img').getAttribute('src'), variant.image);
    assert.equal(node.querySelector('.card-meta span').textContent, variant.rarity);
    assert.equal(Boolean(node.querySelector('.card-thumb.is-foil')), variant.rarity === 'S');
    const before = JSON.stringify(ui.draft());
    await ui.click(opener);
    const dialog = document.querySelector('dialog[open]');
    assert.equal(dialog.dataset.printingId, variant.id);
    assert.equal(dialog.querySelector('.modal-printing-id code').textContent, variant.id);
    assert.equal(dialog.querySelector('.modal-card-image img').getAttribute('src'), variant.image);
    assert.equal(dialog.querySelector('.variant-strip'), null, 'details do not require a grouped version switcher');
    assert.match(dialog.querySelector('.stat-grid').textContent, new RegExp(`稀有度${variant.rarity}`));
    assert.equal(JSON.stringify(ui.draft()), before, 'opening exact artwork does not edit quantities');
    await ui.click(dialog.querySelector('.add-large'));
    assert.equal(ui.draft().printings[lami.number][variant.id], 1);
    await ui.click(document.querySelector('.modal-close'));
    assert.equal(document.activeElement, opener);
  }
  assert.equal(quantity(lami.variants[0].id), 1);
  assert.equal(quantity(lami.variants[1].id), 1);
  await ui.click(minus(lami.variants[1].id));
  assert.deepEqual(ui.draft().printings[lami.number], { [lami.variants[0].id]: 1 });
  assert.equal(document.querySelector('dialog'), null, 'catalog minus acts on its exact printing');
  await ui.click(document.querySelector('.deck-only-filter input'));
  assert.deepEqual(tiles().map(node => node.dataset.printingId), [lami.variants[0].id]);
  assert.match(result(), /^1\s*款卡圖/);
  assert.equal(localStorage.getItem('unrelated-deck'), 'unchanged');
  assert.ok(ui.requests.every(url => !/yuyu-tei/i.test(url)));
});

test('ordinary and restricted card-number limits apply across independently displayed printings', async t => {
  const ui = await workspace(t); await ui.mount(); await search(ui)(lami.number);
  const [regular, parallel] = lami.variants;
  await ui.click(add(regular.id)); await ui.click(add(parallel.id));
  await ui.click(add(regular.id)); await ui.click(add(parallel.id));
  assert.equal(ui.draft().main[lami.number], 4);
  assert.deepEqual(ui.draft().printings[lami.number], { [regular.id]: 2, [parallel.id]: 2 });
  await ui.click(add(parallel.id));
  assert.equal(ui.draft().main[lami.number], 4, 'alternate artwork cannot bypass four-copy limit');
  assert.match(document.querySelector('.t-toast').textContent, /同卡號最多 4 張/);
  await ui.click(minus(regular.id)); await ui.click(add(parallel.id));
  assert.deepEqual(ui.draft().printings[lami.number], { [regular.id]: 1, [parallel.id]: 3 });
  await search(ui)(restricted.number);
  assert.equal(restricted.maxCopies, 1); assert.equal(restricted.restricted, true); assert.ok(restricted.variants.length > 1);
  await ui.click(add(restricted.variants[0].id));
  await ui.click(add(restricted.variants[1].id));
  assert.equal(ui.draft().main[restricted.number], 1, 'restricted alternate art shares the same one-copy allowance');
  assert.deepEqual(ui.draft().printings[restricted.number], { [restricted.variants[0].id]: 1 });
  assert.match(document.querySelector('.t-toast').textContent, /限制卡.*最多 1 張/);
  await ui.click(minus(restricted.variants[0].id)); await ui.click(add(restricted.variants[1].id));
  assert.deepEqual(ui.draft().printings[restricted.number], { [restricted.variants[1].id]: 1 });
});

test('rapid mixed-printing additions cannot exceed the canonical ordinary or restricted limit', async t => {
  const ui = await workspace(t); await ui.mount(); await search(ui)(lami.number);
  await ui.act(async () => {
    for (let count = 0; count < 8; count++) add(lami.variants[count % 2].id).click();
    await ui.settle();
  });
  assert.equal(ui.draft().main[lami.number], 4);
  assert.equal(Object.values(ui.draft().printings[lami.number]).reduce((sum, count) => sum + count, 0), 4);
  await search(ui)(restricted.number);
  await ui.act(async () => {
    for (let count = 0; count < 4; count++) add(restricted.variants[count % 2].id).click();
    await ui.settle();
  });
  assert.equal(ui.draft().main[restricted.number], 1);
  assert.equal(Object.values(ui.draft().printings[restricted.number]).reduce((sum, count) => sum + count, 0), 1);
});

test('legacy aggregate drafts remain byte-identical until edited and chosen artwork survives save and reload', async t => {
  const legacy = { oshi: {}, main: { [lami.number]: 2 }, cheer: {} };
  const ui = await workspace(t, legacy), raw = JSON.stringify(legacy); await ui.mount();
  await search(ui)(lami.number);
  assert.equal(localStorage.getItem(ui.store.draftKey()), raw, 'browsing must not rewrite a legacy durable draft');
  assert.equal(tiles().reduce((sum, node) => sum + Number(node.querySelector('output').textContent), 0), 2);
  await ui.click(add(lami.variants[1].id));
  const expected = ui.draft();
  assert.equal(expected.main[lami.number], 3);
  assert.equal(expected.printings[lami.number][lami.variants[1].id], 1);
  await ui.mount(); await search(ui)(lami.number);
  assert.deepEqual(ui.draft(), expected);
  assert.equal(quantity(lami.variants[1].id), 1);
  await ui.click(document.querySelector('.studio-masthead-actions .studio-primary'));
  await ui.input(document.querySelector('.deck-name-field input'), '獨立卡圖保存');
  await ui.click(document.querySelector('.save-button'));
  const saved = ui.store.listLocalDecks().find(row => row.name === '獨立卡圖保存');
  assert.ok(saved); assert.deepEqual(saved.deck, expected);
  await ui.mount(`/?deck=${saved.id}`);
  assert.deepEqual(ui.draft(), expected);
  assert.equal(document.querySelectorAll('.deck-card-tile').length, 2);
  const chosen = [...document.querySelectorAll('.deck-card-tile')].find(node => node.querySelector('img')?.getAttribute('src') === lami.variants[1].image);
  await ui.click(chosen.querySelector('.deck-card-open'));
  assert.equal(document.querySelector('dialog').dataset.printingId, lami.variants[1].id);
});

test('the selected preview printing retains its own artwork, rarity, source sets and release date', async t => {
  const card = catalog.cards.find(card => card.number === 'hSD14-010');
  const preview = card.variants.find(variant => variant.id === 'official-hSD14-010-3042');
  assert.equal(card.preview, false); assert.equal(preview.preview, true);
  const ui = await workspace(t); await ui.mount(); await search(ui)(card.number);
  await ui.click(tile(preview.id).querySelector('.card-open'));
  const dialog = document.querySelector('dialog');
  assert.equal(dialog.dataset.printingId, preview.id);
  assert.equal(dialog.querySelector('.modal-printing-id code').textContent, preview.id);
  assert.equal(dialog.querySelector('.modal-card-image img').getAttribute('src'), preview.image);
  assert.match(dialog.querySelector('.stat-grid').textContent, new RegExp(`稀有度${preview.rarity}`));
  assert.match(dialog.querySelector('.preview-badge').textContent, /官方先行公開/);
  assert.ok(dialog.textContent.includes(preview.releaseDate));
  for (const set of preview.sets) assert.ok(dialog.querySelector('.effect-stack + .modal-source').textContent.includes(set), `exact preview set: ${JSON.stringify(set)}; rendered: ${JSON.stringify(dialog.querySelector('.effect-stack + .modal-source').textContent)}`);
  assert.equal(dialog.querySelector('.variant-strip'), null);
});

test('HoloSim export and reimport preserve selected printing allocation alongside canonical numbers', async t => {
  const variant = restricted.variants[1];
  const initial = { oshi: { [supportedOshi.number]: 1 }, main: { [restricted.number]: 1 }, cheer: {}, printings: { [restricted.number]: { [variant.id]: 1 } } };
  const ui = await workspace(t, initial); await ui.mount();
  await ui.click(document.querySelector('.studio-masthead-actions .studio-primary'));
  await ui.input(document.querySelector('.deck-name-field input'), '卡圖往返');
  const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  const oldAnchorClick = ui.dom.window.HTMLAnchorElement.prototype.click;
  let blob, filename;
  URL.createObjectURL = value => { blob = value; return 'blob:printing-test'; };
  URL.revokeObjectURL = () => {};
  ui.dom.window.HTMLAnchorElement.prototype.click = function () { filename = this.download; };
  t.after(() => { URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke; ui.dom.window.HTMLAnchorElement.prototype.click = oldAnchorClick; });
  await ui.click(document.querySelector('.export-button'));
  assert.equal(filename, '卡圖往返.json'); assert.ok(blob);
  const exported = JSON.parse(await blob.text());
  assert.deepEqual(exported.mainDeckCardNumbers, [simIndex[restricted.number][0]]);
  assert.equal(exported.oshiCardNumber, simIndex[supportedOshi.number].find(id => id === `${supportedOshi.number}_0`) || simIndex[supportedOshi.number][0]);
  assert.deepEqual(exported.yellDeckCardNumbers, []);
  assert.deepEqual(exported.printings, initial.printings);
  await ui.importJson(exported);
  assert.deepEqual(ui.draft(), initial);
  await ui.mount(); await search(ui)(restricted.number);
  assert.equal(quantity(variant.id), 1);
  assert.equal(quantity(restricted.variants[0].id), 0);
});



