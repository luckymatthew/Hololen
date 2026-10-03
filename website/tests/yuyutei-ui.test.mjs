import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'localStorage', 'location', 'HTMLElement', 'HTMLInputElement', 'CustomEvent', 'Event']) globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
const payload = JSON.parse(readFileSync('public/cards.json', 'utf8'));
const cards = ['hBP03-001', 'hBP08-001', 'hPR-001'].map(number => payload.cards.find(c => c.number === number));
const manifest = JSON.parse(readFileSync('lib/yuyutei-products.json', 'utf8'));
const expectedProduct = (card, id) => manifest.products.find(product => product.number === card.number && product.printingId === id);
function assertAction(container, card, id) {
  const product = expectedProduct(card, id), variant = card.variants.find(v => v.id === id);
  const anchor = container.querySelector('.retailer-link'), action = container.querySelector('.retailer-action');
  assert.equal(anchor.href, product?.url || `https://yuyu-tei.jp/sell/hocg/s/search?search_word=${encodeURIComponent(card.number)}`);
  assert.equal(action.dataset.linkKind, product ? 'product' : 'search');
  assert.ok(anchor.getAttribute('aria-label').includes(variant.rarity));
  assert.match(anchor.textContent, product ? /遊遊亭價格/ : /搜尋遊遊亭/);
  assert.match(action.querySelector('small').textContent, product ? /開啟外部網站查看現價/ : /尚未核對.*選擇對應版本.*卡圖/);
}
globalThis.fetch = async url => {
  if (url === '/cards.json') return Response.json({ ...payload, cards });
  if (url === '/holosim-card-index.json') return Response.json({});
  throw new Error(`Unexpected network request: ${url}`);
};
mkdirSync('work', { recursive: true });
await build({ stdin: { contents: `export { default as Home } from './app/page'; export { draftKey } from './lib/firebase/store';`, resolveDir: process.cwd(), loader: 'tsx' }, outfile: 'work/yuyutei-ui-test.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', alias: { 'next/link': './firebase/Link.tsx' }, define: { 'import.meta.env': JSON.stringify({ VITE_APP_BACKEND: 'firebase' }) } });
const { Home, draftKey } = await import('../work/yuyutei-ui-test.mjs');
await build({ stdin: { contents: readFileSync('app/simulator/SimulatorClient.tsx', 'utf8') + '\nexport { CardInspector };', resolveDir: `${process.cwd()}/app/simulator`, loader: 'tsx' }, outfile: 'work/yuyutei-inspector-test.mjs', jsx: 'automatic', bundle: true, platform: 'node', format: 'esm', packages: 'external', alias: { 'next/link': './firebase/Link.tsx' }, define: { 'import.meta.env': JSON.stringify({ VITE_APP_BACKEND: 'firebase' }) } });
const { CardInspector } = await import('../work/yuyutei-inspector-test.mjs');
const { createElement, act } = await import('react');
const { createRoot } = await import('react-dom/client');

test('real card details update external links with the selected printing without editing the saved draft', async () => {
  const draft = JSON.stringify({ oshi: { 'hBP03-001': 1 }, main: {}, cheer: {}, printings: { 'hBP03-001': { '678': 1 } } });
  localStorage.setItem(draftKey(), draft);
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(Home)));
  const before = localStorage.getItem(draftKey());
  async function open(card) {
    const button = [...document.querySelectorAll('button')].find(b => !b.closest('[hidden]') && b.getAttribute('aria-label') === `查看 ${card.name} 詳情`);
    assert.ok(button); await act(async () => button.click());
    return document.querySelector('dialog');
  }
  async function close(dialog) { await act(async () => dialog.querySelector('.modal-close').click()); }
  let dialog = await open(cards[0]);
  const anchor = () => dialog.querySelector('.retailer-link');
  assertAction(dialog, cards[0], '565');
  assert.equal(anchor().target, '_blank');
  assert.equal(anchor().rel, 'noopener noreferrer');
  await act(async () => dialog.querySelector('.variant-strip button[title="OUR 卡圖"]').click());
  assertAction(dialog, cards[0], '678');
  await close(dialog);
  dialog = await open(cards[1]);
  await act(async () => dialog.querySelector('.variant-strip button[title="OUR 卡圖"]').click());
  assertAction(dialog, cards[1], '2331');
  await close(dialog);
  dialog = await open(cards[2]);
  assert.equal(dialog.querySelector('.retailer-action').dataset.linkKind, 'search');
  assert.equal(new URL(anchor().href).searchParams.get('search_word'), 'hPR-001');
  assert.equal(localStorage.getItem(draftKey()), before);
  await act(async () => root.unmount());
});

test('persistent simulator inspector follows the visible printing and hover previews stay compact', async () => {
  const root = createRoot(document.getElementById('root'));
  const luna = cards[0], cardMap = new Map([[luna.number, luna]]);
  const render = props => act(async () => root.render(createElement(CardInspector, { card: luna, cardMap, ...props })));
  await render({ variantId: '678' });
  assertAction(document, luna, '678');
  await render({ variantId: '565' });
  assertAction(document, luna, '565');
  await render({ variantId: 'unknown' });
  assert.equal(document.querySelector('.retailer-action').dataset.linkKind, 'search');
  await render({ variantId: '678', hover: true });
  assert.equal(document.querySelector('.retailer-action'), null);
  await act(async () => root.unmount());
});
