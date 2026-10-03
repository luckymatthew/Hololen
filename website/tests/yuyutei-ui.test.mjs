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
  assert.equal(anchor().href, 'https://yuyu-tei.jp/sell/hocg/card/hbp03/10001');
  assert.equal(anchor().target, '_blank');
  assert.equal(anchor().rel, 'noopener noreferrer');
  assert.match(anchor().getAttribute('aria-label'), /OSR.*外部網站/);
  await act(async () => dialog.querySelector('.variant-strip button[title="OUR 卡圖"]').click());
  assert.equal(anchor().href, 'https://yuyu-tei.jp/sell/hocg/card/hbp03/10002');
  assert.match(anchor().getAttribute('aria-label'), /OUR/);
  await close(dialog);
  dialog = await open(cards[1]);
  await act(async () => dialog.querySelector('.variant-strip button[title="OUR 卡圖"]').click());
  assert.equal(dialog.querySelector('.retailer-action').dataset.linkKind, 'search');
  assert.match(anchor().textContent, /搜尋遊遊亭/);
  assert.match(dialog.querySelector('.retailer-action small').textContent, /尚未核對.*Google.*卡圖/);
  await close(dialog);
  dialog = await open(cards[2]);
  assert.equal(dialog.querySelector('.retailer-action').dataset.linkKind, 'search');
  assert.match(new URL(anchor().href).searchParams.get('q'), /"hPR-001" "P"/);
  assert.equal(localStorage.getItem(draftKey()), before);
  await act(async () => root.unmount());
});

test('persistent simulator inspector follows the visible printing and hover previews stay compact', async () => {
  const root = createRoot(document.getElementById('root'));
  const luna = cards[0], cardMap = new Map([[luna.number, luna]]);
  const render = props => act(async () => root.render(createElement(CardInspector, { card: luna, cardMap, ...props })));
  await render({ variantId: '678' });
  assert.equal(document.querySelector('.retailer-link').href, 'https://yuyu-tei.jp/sell/hocg/card/hbp03/10002');
  await render({ variantId: '565' });
  assert.equal(document.querySelector('.retailer-link').href, 'https://yuyu-tei.jp/sell/hocg/card/hbp03/10001');
  await render({ variantId: 'unknown' });
  assert.equal(document.querySelector('.retailer-action').dataset.linkKind, 'search');
  await render({ variantId: '678', hover: true });
  assert.equal(document.querySelector('.retailer-action'), null);
  await act(async () => root.unmount());
});
