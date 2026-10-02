import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { LEGACY_CHEER_PRINTINGS, projectLegacyPrintings, projectLegacyCardReference } from '../lib/printing-compatibility.mjs';
import { validateBattleDeck } from '../lib/simulator/engine.mjs';
import { content, mergeDecision } from '../lib/firebase/merge.mjs';
import { toHoloSimDeck, fromHoloSimDeck } from '../lib/holosim-deck.mjs';

const payload = JSON.parse(readFileSync('public/cards.json', 'utf8'));
const cards = payload.cards;
const cardMap = new Map(cards.map(card => [card.number, card]));
const oshi = cards.find(card => card.group === 'oshi');
const eligible = cards.filter(card => ['holomem', 'support'].includes(card.group) && card.maxCopies >= 4);
const debut = eligible.find(card => card.stage === 'Debut');
const main = {};
let remaining = 50;
for (const card of [debut, ...eligible.filter(card => card !== debut)]) {
  const count = Math.min(remaining, 4);
  main[card.number] = count;
  remaining -= count;
  if (!remaining) break;
}
function example(mapping, legacyCount = 7, syCount = 13) {
  const sy = cardMap.get(mapping.number).variants.find(variant => variant.rarity === 'SY').id;
  return { oshi: { [oshi.number]: 1 }, main: { ...main }, cheer: { [mapping.number]: legacyCount + syCount }, printings: { [mapping.number]: { [mapping.variantId]: legacyCount, ...(syCount ? { [sy]: syCount } : {}) } } };
}

for (const mapping of LEGACY_CHEER_PRINTINGS) {
  test(`${mapping.number}: transfers only legacy S, preserves SY, count and raw record`, () => {
    const raw = example(mapping), serialized = JSON.stringify(raw);
    const projected = projectLegacyPrintings(raw);
    assert.equal(validateBattleDeck(raw, cards).ok, false);
    assert.equal(validateBattleDeck(projected, cards).ok, true);
    assert.equal(projected.cheer[mapping.number], 13);
    assert.equal(projected.cheer[mapping.targetNumber], 7);
    assert.equal(projected.printings[mapping.targetNumber][mapping.targetVariantId], 7);
    assert.equal(projected.printings[mapping.number][mapping.variantId], undefined);
    assert.equal(Object.values(projected.cheer).reduce((a, b) => a + b, 0), 20);
    assert.equal(JSON.stringify(raw), serialized);
    assert.equal(projectLegacyPrintings(projected), projected);
    assert.equal(cardMap.get(mapping.number).id, mapping.variantId, 'stable card identity is not rewritten');
    assert.equal(cardMap.get(mapping.targetNumber).variants.find(v => v.id === mapping.targetVariantId).rarity, 'S');
  });
}

test('coalesces existing canonical S and retains unspecified original-card quantities', () => {
  const mapping = LEGACY_CHEER_PRINTINGS[0], raw = example(mapping, 5, 8);
  raw.cheer[mapping.number] = 15; // Two unspecified copies stay on the original card.
  raw.cheer[mapping.targetNumber] = 5;
  raw.printings[mapping.targetNumber] = { [mapping.targetVariantId]: 3 };
  const result = projectLegacyPrintings(raw);
  assert.deepEqual(result.cheer, { [mapping.number]: 10, [mapping.targetNumber]: 10 });
  assert.equal(result.printings[mapping.targetNumber][mapping.targetVariantId], 8);
  assert.equal(validateBattleDeck(result, cards).ok, true);
});

test('handles full legacy allocation, all six aliases together and immutable input', () => {
  const raw = { oshi: {}, main: {}, cheer: {}, printings: {} };
  for (const mapping of LEGACY_CHEER_PRINTINGS) {
    raw.cheer[mapping.number] = 2;
    raw.printings[mapping.number] = Object.freeze({ [mapping.variantId]: 2 });
  }
  Object.freeze(raw.cheer); Object.freeze(raw.printings); Object.freeze(raw);
  const projected = projectLegacyPrintings(raw);
  assert.equal(Object.values(projected.cheer).reduce((a, b) => a + b, 0), 12);
  for (const mapping of LEGACY_CHEER_PRINTINGS) {
    assert.equal(projected.cheer[mapping.number], undefined);
    assert.equal(projected.printings[mapping.number], undefined);
    assert.equal(projected.cheer[mapping.targetNumber], 2);
  }
});

test('does not guess unknown IDs, card.id references, wrong card-number pairs or malformed quantities', () => {
  const mapping = LEGACY_CHEER_PRINTINGS[0];
  const noAllocation = { oshi: {}, main: {}, cheer: { [mapping.number]: 20 } };
  assert.equal(projectLegacyPrintings(noAllocation), noAllocation);
  for (const count of [-1, 0, 0.5, 21, 'not-a-number']) {
    const malformed = example(mapping, 7, 13);
    malformed.printings[mapping.number][mapping.variantId] = count;
    assert.equal(projectLegacyPrintings(malformed), malformed);
  }
  const wrongPair = example(mapping);
  wrongPair.printings[mapping.number] = { [LEGACY_CHEER_PRINTINGS[1].variantId]: 7 };
  assert.equal(projectLegacyPrintings(wrongPair), wrongPair);
  const invalidDestination = example(mapping);
  invalidDestination.printings[mapping.targetNumber] = { [mapping.targetVariantId]: 1 };
  assert.equal(projectLegacyPrintings(invalidDestination), invalidDestination);
  const unknown = example(mapping);
  unknown.printings[mapping.number]['unknown-printing'] = 1;
  unknown.printings[mapping.number][mapping.variantId] = 6;
  const projected = projectLegacyPrintings(unknown);
  assert.equal(projected.printings[mapping.number]['unknown-printing'], 1);
  assert.equal(validateBattleDeck(projected, cards).ok, false);
});

test('sync content and full raw JSON stay unchanged; HoloSim gets corrected card numbers', () => {
  const mapping = LEGACY_CHEER_PRINTINGS[0], raw = example(mapping);
  const record = { id: 'legacy', name: 'Legacy deck', deck: raw, notes: 'Retain', updatedAt: 100 };
  const before = content(record), projected = projectLegacyPrintings(raw);
  assert.equal(content(record), before);
  assert.equal(mergeDecision({ ...record, _dirty: false }, record).winner, record);
  const index = Object.fromEntries([...Object.keys(projected.oshi), ...Object.keys(projected.main), ...Object.keys(projected.cheer)].map(number => [number, [`${number}_0`]]));
  const exported = toHoloSimDeck(projected, index);
  assert.deepEqual(exported.unsupported, []);
  assert.deepEqual(fromHoloSimDeck(exported.deck).cheer, projected.cheer);
  const realIndex = JSON.parse(readFileSync('public/holosim-card-index.json', 'utf8'));
  assert(!toHoloSimDeck(projected, realIndex).unsupported.includes(mapping.targetNumber));
  assert.deepEqual(JSON.parse(JSON.stringify(record)).deck, raw);
});

test('production components, account backup/import and solo startup project without rewriting stored sources', async t => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
  for (const key of ['window', 'document', 'localStorage', 'location', 'HTMLElement', 'HTMLInputElement', 'CustomEvent', 'Event']) globalThis[key] = dom.window[key];
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  globalThis.fetch = async url => {
    if (url === '/cards.json') return Response.json(payload);
    if (url === '/holosim-card-index.json') return Response.json(JSON.parse(readFileSync('public/holosim-card-index.json', 'utf8')));
    throw new Error(`Unexpected network request: ${url}`);
  };
  mkdirSync('work', { recursive: true });
  const bundle = `work/printing-compatibility-test-${process.pid}.mjs`;
  await build({ stdin: { contents: `export { default as Home } from './app/page'; export { default as Account } from './app/account/FirebaseAccount'; export { default as Simulator, CardFace, cardPrintingLabel, CardInspector } from './app/simulator/SimulatorClient'; export * as store from './lib/firebase/store'; export * as pvp from './lib/firebase/pvp';`, resolveDir: process.cwd(), loader: 'tsx' }, outfile: bundle, bundle: true, platform: 'node', format: 'esm', packages: 'external', alias: { 'next/link': './firebase/Link.tsx' }, define: { 'import.meta.env': JSON.stringify({ VITE_APP_BACKEND: 'firebase' }) }, plugins: [{ name: 'inspect-private-display-functions', setup(builder) { builder.onLoad({ filter: /SimulatorClient\.tsx$/ }, args => ({ contents: readFileSync(args.path, 'utf8') + '\nexport { CardFace, cardPrintingLabel, CardInspector };', loader: 'tsx' })); } }] });
  const { Home, Account, Simulator, CardFace, cardPrintingLabel, CardInspector, store, pvp } = await import(new URL(`../${bundle}`, import.meta.url));
  const { createElement, act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  let root;
  const mount = async (Component, url) => {
    if (root) await act(async () => root.unmount());
    window.history.replaceState({}, '', url);
    root = createRoot(document.getElementById('root'));
    await act(async () => { root.render(createElement(Component)); });
  };
  try {
    await t.test('all six old draft loads render S plus SY while retaining raw draft JSON', async () => {
      for (const mapping of LEGACY_CHEER_PRINTINGS) {
        const raw = example(mapping), serialized = JSON.stringify(raw);
        localStorage.setItem(store.draftKey(), serialized);
        await mount(Home, '/deck');
        assert.equal(localStorage.getItem(store.draftKey()), serialized);
        const tiles = [...document.querySelectorAll('.deck-card-tile')];
        const s = tiles.find(tile => tile.querySelector('em')?.textContent === 'S');
        const sy = tiles.find(tile => tile.querySelector('em')?.textContent === 'SY');
        assert(s && sy);
        assert.match(s.textContent, /×7/);
        assert.match(sy.textContent, /×13/);
        assert(s.querySelector('img').src.includes(`${mapping.targetNumber}_S.png`));
        assert(sy.querySelector('img').src.includes(`${mapping.number}_SY.png`));
      }
    });
    await t.test('account backup import, active Firebase preview and saved-deck load preserve raw records', async () => {
      const mapping = LEGACY_CHEER_PRINTINGS[0], raw = example(mapping), serialized = JSON.stringify(raw);
      const collection = { [mapping.variantId]: 7, notes: 'Opaque stable card or printing IDs must stay unchanged' };
      store.importDecks({ decks: [{ id: 'source', name: 'Legacy fixture', deck: raw }], data: [{ id: 'collection', value: collection }], draft: serialized });
      const row = store.listLocalDecks().find(row => row.name === 'Legacy fixture');
      const before = content(row);
      await mount(Account, '/account');
      assert.match(document.body.textContent, /原始已存牌組保留/);
      assert.equal(content(store.getLocalDeck(row.id)), before);
      await mount(Home, `/?deck=${row.id}`);
      assert.equal(content(store.getLocalDeck(row.id)), before);
      assert.equal(localStorage.getItem(store.draftKey()), serialized);
      const backup = store.backupLocalData();
      assert.deepEqual(backup.decks.find(row => row.name === 'Legacy fixture').deck, raw);
      assert.deepEqual(backup.data.find(row => row.id === 'collection').value, collection);
      assert.equal(backup.draft, serialized);
    });
    await t.test('builder file import resolves legacy IDs before catalog filtering', async () => {
      const mapping = LEGACY_CHEER_PRINTINGS[1], raw = example(mapping);
      await mount(Home, '/deck');
      const input = document.querySelector('.import-button input[type="file"]');
      Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'legacy.json', size: 4096, text: async () => JSON.stringify({ deck: raw }) }] });
      await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
      const stored = JSON.parse(localStorage.getItem(store.draftKey()));
      assert.deepEqual(stored, projectLegacyPrintings(raw));
      assert.equal(stored.printings[mapping.targetNumber][mapping.targetVariantId], 7);
    });
    await t.test('explicit edit changes only selected S quantity; explicit save commits without a false conflict', async () => {
      const mapping = LEGACY_CHEER_PRINTINGS[0];
      const row = store.listLocalDecks().find(row => row.name === 'Legacy fixture');
      const original = JSON.stringify(row.deck), countBefore = store.listLocalDecks().length;
      await mount(Home, `/?deck=${row.id}`);
      const s = [...document.querySelectorAll('.deck-card-tile')].find(tile => tile.querySelector('em')?.textContent === 'S');
      const minus = [...s.querySelectorAll('button')].find(button => button.getAttribute('aria-label')?.startsWith('減少'));
      await act(async () => minus.click());
      const edited = JSON.parse(localStorage.getItem(store.draftKey()));
      assert.equal(edited.cheer[mapping.targetNumber], 6);
      assert.equal(edited.cheer[mapping.number], 13);
      assert.equal(JSON.stringify(store.getLocalDeck(row.id).deck), original);
      await act(async () => document.querySelector('.save-button').click());
      assert.deepEqual(store.getLocalDeck(row.id).deck, edited);
      assert.equal(store.listLocalDecks().length, countBefore, 'projection alone must not cause a sync conflict fork');
    });
    await t.test('simulator reads raw draft and starts solo with canonical player and opponent printings', async () => {
      const mapping = LEGACY_CHEER_PRINTINGS[2], raw = example(mapping), serialized = JSON.stringify(raw);
      localStorage.setItem(store.draftKey(), serialized);
      // Simulator's existing draft storage key is the original guest draft key.
      localStorage.setItem('hololive-ocg-deck-draft-v1', serialized);
      await mount(Simulator, '/simulator');
      assert.equal(localStorage.getItem(store.draftKey()), serialized);
      const request = { name: 'Compatibility test', deck: raw, opponentDeck: example(LEGACY_CHEER_PRINTINGS[3]), singlePlayer: true };
      const original = JSON.stringify(request);
      const room = await pvp.createRoom(request);
      assert.equal(JSON.stringify(request), original);
      const savedRoom = JSON.parse(localStorage.getItem(`holo-solo-v1:${room.code}`));
      assert.equal(savedRoom.state.players[0].cheerDeck.filter(card => card.number === mapping.targetNumber && card.variantId === mapping.targetVariantId).length, 7);
      assert.equal(savedRoom.state.players[1].cheerDeck.filter(card => card.variantId === LEGACY_CHEER_PRINTINGS[3].targetVariantId).length, 7);
      assert.equal(localStorage.getItem(store.draftKey()), serialized);
    });
    await t.test('existing saved-room artwork, label and inspector resolve S without changing battle state', async () => {
      for (const mapping of LEGACY_CHEER_PRINTINGS) {
        const instance = Object.freeze({ id: `original-instance-${mapping.number}`, number: mapping.number, variantId: mapping.variantId });
        const savedRoom = { code: 'AI-existing-room', version: 17, state: { players: [{ cheerDeck: [instance], archive: [], zones: {} }], log: [{ cardRefs: [instance] }] } };
        const original = JSON.stringify(savedRoom);
        const reference = projectLegacyCardReference(instance);
        assert.equal(reference.id, instance.id);
        assert.equal(projectLegacyCardReference(reference), reference);
        const Display = () => createElement('div', null,
          createElement(CardFace, { instance: savedRoom.state.players[0].cheerDeck[0], cardMap }),
          createElement('span', { className: 'test-printing-label' }, cardPrintingLabel(instance, cardMap)),
          createElement(CardInspector, { card: cardMap.get(mapping.number), variantId: instance.variantId, cardMap }));
        await mount(Display, '/simulator');
        assert.equal(document.querySelector('.sim-card-face').dataset.cardNumber, mapping.targetNumber);
        assert.equal(document.querySelector('.sim-card-face').dataset.variantId, mapping.targetVariantId);
        assert.equal(document.querySelector('.test-printing-label').textContent, `${mapping.targetNumber} S`);
        assert.equal(document.querySelector('.sim-inspector-head code').textContent, `${mapping.targetNumber} · S`);
        for (const image of document.querySelectorAll('img')) assert(image.src.includes(`${mapping.targetNumber}_S.png`));
        assert.equal(JSON.stringify(savedRoom), original);
      }
    });
  } finally {
    if (root) await act(async () => root.unmount());
    dom.window.close();
    unlinkSync(bundle);
  }
});
