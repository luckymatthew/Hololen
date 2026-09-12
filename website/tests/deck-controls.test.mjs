import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

// Component/DOM tests only: no browser or production Firebase connection.
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'localStorage', 'location', 'HTMLElement', 'HTMLInputElement', 'CustomEvent', 'Event']) globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
const payload = JSON.parse(readFileSync('public/cards.json', 'utf8'));
const oshi = payload.cards.find(c => c.group === 'oshi' && c.variants.length === 1);
const member = payload.cards.find(c => c.group === 'holomem' && c.variants.length > 1);
const cheer = payload.cards.find(c => c.group === 'cheer' && c.variants.length === 1);
const cards = [oshi, member, cheer];
globalThis.fetch = async url => {
  if (url === '/cards.json') return Response.json({ ...payload, cards });
  if (url === '/holosim-card-index.json') return Response.json({});
  throw new Error(`Unexpected network request: ${url}`);
};
mkdirSync('work', { recursive: true });
await build({ stdin: { contents: `export { default as Home } from './app/page'; export { default as Account } from './app/account/FirebaseAccount'; export * as store from './lib/firebase/store';`, resolveDir: process.cwd(), loader: 'tsx' }, outfile: 'work/deck-controls-test.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', alias: { 'next/link': './firebase/Link.tsx' }, define: { 'import.meta.env': JSON.stringify({ VITE_APP_BACKEND: 'firebase' }) } });
const { Home, Account, store } = await import('../work/deck-controls-test.mjs');
const { createElement, act } = await import('react');
const { createRoot } = await import('react-dom/client');
let root;
const draft = () => JSON.parse(localStorage.getItem(store.draftKey()));
function button(name, scope = document) {
  const found = [...scope.querySelectorAll('button')].filter(el => !el.closest('[hidden]') && (el.getAttribute('aria-label') === name || el.textContent.trim() === name));
  assert.ok(found.length, `Missing button: ${name}`);
  return found[0];
}
async function click(name, scope) { await act(async () => button(name, scope).click()); }
async function mount(Component, url = '/') {
  if (root) await act(async () => root.unmount());
  window.history.replaceState({}, '', url);
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(Component)));
}
const quantity = card => Number(document.querySelector(`output[aria-label="${card.name} 牌組張數"]`)?.textContent);

test('catalog, modal, edit modes, saving and removable deck lifecycle', async t => {
  await t.test('catalog can add and remove an oshi down to zero and survive remount', async () => {
    await mount(Home);
    await click(`將 ${oshi.name} 加入牌組`);
    assert.equal(quantity(oshi), 1);
    await click(`從牌組減少 ${oshi.name}`);
    assert.equal(quantity(oshi), 0);
    assert.deepEqual(draft().oshi, {});
    assert.equal(button(`從牌組減少 ${oshi.name}`).disabled, true);
    await mount(Home);
    assert.equal(quantity(oshi), 0);
  });
  await t.test('modal removes the selected printing only, then removes the last printing', async () => {
    await click(`選擇 ${member.name} 卡圖版本`);
    let dialog = document.querySelector('dialog');
    const variants = [...dialog.querySelectorAll('.variant-strip button')];
    await act(async () => dialog.querySelector('.add-large').click());
    const firstId = Object.keys(draft().printings[member.number])[0];
    await act(async () => variants[1].click());
    await act(async () => dialog.querySelector('.add-large').click());
    assert.equal(draft().main[member.number], 2);
    await click(`減少 ${member.name} 所選版本`, dialog);
    assert.deepEqual(draft().printings[member.number], { [firstId]: 1 });
    assert.equal(button(`減少 ${member.name} 所選版本`, dialog).disabled, true);
    await click('關閉卡片詳情');
    await click(`從牌組減少 ${member.name}`);
    assert.equal(draft().main[member.number], undefined);
    assert.equal(draft().printings[member.number], undefined);
  });
  await t.test('add/remove modes and deck steppers keep cheer counts correct', async () => {
    await click('＋ 加卡');
    await click(`增加 ${cheer.name} 卡牌`);
    await click(`增加 ${cheer.name} 卡牌`);
    assert.equal(quantity(cheer), 2);
    await click('− 減卡');
    await click(`減少 ${cheer.name} 卡牌`);
    assert.equal(quantity(cheer), 1);
    await click('查看牌組 · 1 張');
    await click(`減少 ${cheer.name} ${cheer.variants[0].rarity}版本`);
    assert.deepEqual(draft().cheer, {});
    assert.equal(document.querySelectorAll('.deck-card-tile').length, 0);
  });
  await t.test('mixed-printing quick minus opens a choice without removing another version', async () => {
    localStorage.setItem(store.draftKey(), JSON.stringify({ oshi: {}, main: { [member.number]: 2 }, cheer: {}, printings: { [member.number]: { [member.variants[0].id]: 1, [member.variants[1].id]: 1 } } }));
    await mount(Home);
    await click(`從牌組減少 ${member.name}`);
    assert.ok(document.querySelector('dialog[open]'));
    assert.equal(draft().main[member.number], 2);
    await click(`減少 ${member.name} 所選版本`, document.querySelector('dialog'));
    assert.equal(draft().main[member.number], 1);
    await click('關閉卡片詳情');
  });
  await t.test('saved deck accepts removal of its last card and remains empty on reload', async () => {
    let saved;
    await act(async () => { saved = store.saveLocalDeck({ name: 'Control test', deck: { oshi: { [oshi.number]: 1 }, main: {}, cheer: {} } }); });
    await mount(Home, `/?deck=${saved.id}`);
    await click(`減少 ${oshi.name} ${oshi.variants[0].rarity}版本`);
    await click('更新保存');
    assert.deepEqual(store.getLocalDeck(saved.id).deck.oshi, {});
    await mount(Home, `/?deck=${saved.id}`);
    assert.equal(document.querySelectorAll('.deck-card-tile').length, 0);
  });
  await t.test('cancel deletion preserves the deck; delete hides it, remount retains trash, restore recovers it', async () => {
    await mount(Account, '/account');
    assert.equal(document.querySelectorAll('.saved-deck-panel').length, 1);
    await click('刪除牌組');
    await click('取消', document.querySelector('dialog'));
    assert.equal(store.listLocalDecks().length, 1);
    await click('刪除牌組');
    await click('刪除牌組', document.querySelector('dialog'));
    assert.equal(store.listLocalDecks().length, 0);
    assert.equal(document.querySelectorAll('.saved-deck-panel').length, 0);
    await mount(Account, '/account');
    assert.equal(document.querySelectorAll('.saved-deck-panel').length, 0);
    await click('已刪除 · 1');
    assert.equal(document.querySelectorAll('.saved-deck-panel').length, 1);
    assert.equal(document.querySelector('.saved-deck-actions a'), null);
    await click('還原牌組');
    assert.equal(store.listLocalDecks().length, 1);
    await click('我的牌組 · 1');
    assert.equal(document.querySelectorAll('.saved-deck-panel').length, 1);
  });
  await act(async () => root.unmount());
  root = null;
  dom.window.close();
});
