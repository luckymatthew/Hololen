import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import test from 'node:test';
import productData from '../lib/yuyutei-card-products.json' with { type: 'json' };

let index = 0;
async function workspace(t, entry = 'component') {
  const dom = new JSDOM('<button id="before">之前焦點</button><main id="root"></main>', { url: 'https://hololive-ocg.web.app/', pretendToBeVisual: true });
  const keys = ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Event', 'KeyboardEvent', 'MouseEvent', 'localStorage', 'location', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'navigator'];
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: typeof dom.window[key] === 'function' && ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key) ? dom.window[key].bind(dom.window) : dom.window[key] });
  dom.window.matchMedia = query => ({ matches: query.includes('reduced-motion') || query.includes('901px'), media: query, addEventListener() {}, removeEventListener() {} });
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); this.querySelector('button')?.focus(); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const oldFetch = globalThis.fetch, oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const catalog = JSON.parse(readFileSync('public/cards.json', 'utf8')), requests = [];
  globalThis.fetch = async url => { requests.push(String(url)); return Response.json(String(url).includes('cards.json') ? catalog : {}); };
  mkdirSync('work', { recursive: true }); const outfile = `work/yuyutei-ui-${process.pid}-${index++}.mjs`;
  await build({ stdin: { contents: `export { default } from './app/${entry === 'home' ? 'page' : 'YuyuteiCardLink'}';`, resolveDir: process.cwd(), loader: 'tsx' }, outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', alias: { '@': process.cwd(), 'next/link': './firebase/Link.tsx' }, define: { 'import.meta.env': JSON.stringify({ VITE_APP_BACKEND: 'firebase' }) } });
  const component = (await import(new URL(`../${outfile}`, import.meta.url))).default;
  const { createElement: h, act } = await import('react'); const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root')), settle = () => new Promise(resolve => setTimeout(resolve, 35));
  const render = async props => { await act(async () => { root.render(h(component, props)); await settle(); }); };
  const click = async node => { assert.ok(node); node.focus(); await act(async () => { node.click(); await settle(); }); };
  const input = async (node, value) => { await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(node, value); node.dispatchEvent(new dom.window.Event('input', { bubbles: true })); await settle(); }); };
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); unlinkSync(outfile); for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } globalThis.fetch = oldFetch; globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct; });
  return { dom, component, h, act, render, click, input, settle, catalog, requests };
}

const exactRow = () => { assert.equal(productData.status, 'verified-android-port'); assert.equal(productData.products.length, 15); return productData.products[0]; };
const retailer = () => document.querySelector('[data-yuyutei-kind]');

test('reviewed artwork renders an accessible safe new-tab product link, never a price or stock quote', async t => {
  const row = exactRow(), ui = await workspace(t); localStorage.setItem('preserved-deck', 'unchanged');
  await ui.render({ cardNumber: row.cardNumber, imageUrl: row.officialImageUrl });
  const link = retailer().querySelector('a'); assert.equal(link.href, row.productUrl); assert.equal(link.target, '_blank');
  assert.deepEqual(new Set(link.rel.split(' ')), new Set(['noopener', 'noreferrer'])); assert.match(link.getAttribute('aria-label'), /新分頁/);
  assert.match(link.textContent, /此卡圖商品/); assert.match(retailer().textContent, /已按目前所選卡圖/);
  link.focus(); assert.equal(document.activeElement, link);
  assert.equal(localStorage.getItem('preserved-deck'), 'unchanged'); assert.equal(ui.requests.length, 0);
});

test('changing a selected printing synchronously removes an unrelated exact product match and can restore it', async t => {
  const row = exactRow(), ui = await workspace(t);
  await ui.render({ cardNumber: row.cardNumber, imageUrl: row.officialImageUrl }); assert.equal(retailer().dataset.yuyuteiKind, 'product');
  await ui.render({ cardNumber: row.cardNumber, imageUrl: row.officialImageUrl.replace(/\.png$/, '-unmatched.png') });
  assert.notEqual(retailer().dataset.yuyuteiKind, 'product'); assert.notEqual(retailer().querySelector('a')?.href, row.productUrl);
  assert.match(retailer().textContent, /尚未確認|未核實/);
  await ui.render({ cardNumber: row.cardNumber, imageUrl: row.officialImageUrl }); assert.equal(retailer().querySelector('a').href, row.productUrl);
  await ui.render({ cardNumber: 'invalid<script>', imageUrl: row.officialImageUrl }); assert.equal(retailer(), null);
});

test('real card modal follows selected artwork without changing printing quantities, storage, focus restoration or retailer privacy', async t => {
  const first = exactRow(), ui = await workspace(t, 'home'); localStorage.setItem('unrelated-user-deck', 'preserve-me');
  const row = productData.products.find(row => ui.catalog.cards.find(card => card.number === row.cardNumber)?.variants.length > 1) || first;
  const card = ui.catalog.cards.find(card => card.number === row.cardNumber);
  await ui.render(); await ui.input(document.querySelector('input[type="search"]'), row.cardNumber);
  const tiles = [...document.querySelectorAll('.card-tile')].filter(tile => tile.dataset.cardNumber === card.number);
  assert.equal(tiles.length, card.variants.length);
  const expectedByImage = new Map(productData.products.filter(product => product.cardNumber === row.cardNumber).map(product => [product.officialImageUrl, product.productUrl]));
  let quantityBefore, matchedProduct = false;
  for (const tile of tiles) {
    const opener = tile.querySelector('.card-open'); await ui.click(opener);
    assert.equal(document.querySelector('.studio-card-dialog').dataset.printingId, tile.dataset.printingId);
    const image = card.variants.find(variant => variant.id === tile.dataset.printingId).image;
    const expected = expectedByImage.get(image);
    if (expected) { matchedProduct = true; assert.equal(retailer().dataset.yuyuteiKind, 'product'); assert.equal(retailer().querySelector('a').href, expected); }
    else assert.notEqual(retailer().dataset.yuyuteiKind, 'product');
    quantityBefore ??= document.querySelector('.modal-quantity-controls output').textContent;
    assert.equal(document.querySelector('.modal-quantity-controls output').textContent, quantityBefore, 'a retailer selection never edits quantities');
    await ui.click(document.querySelector('.modal-close')); assert.equal(document.activeElement, opener);
  }
  assert.equal(matchedProduct, true, 'at least one visible printing resolves the verified exact product');
  assert.ok(card.variants.length > 0); assert.equal(localStorage.getItem('unrelated-user-deck'), 'preserve-me');
  assert.ok(!ui.requests.some(url => /yuyu-tei/i.test(url)), 'no retailer tracking or fetch before the user chooses an external link');
  const opener = tiles[0].querySelector('.card-open');
  await ui.click(opener); assert.equal(document.querySelectorAll('dialog').length, 1);
  await ui.act(async () => { document.querySelector('dialog').dispatchEvent(new ui.dom.window.Event('cancel', { cancelable: true })); await ui.settle(); });
  assert.equal(document.querySelector('dialog'), null); assert.equal(document.activeElement, opener);
  assert.equal(localStorage.getItem('unrelated-user-deck'), 'preserve-me');
});
