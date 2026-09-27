import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const engineTarget = process.env.HOLO_ENGINE_TEST_TARGET || 'lib/simulator/engine.mjs';
const catalogTarget = process.env.HOLO_CARD_CATALOG_TEST_TARGET || 'public/cards.json';
const { applyAction, isActionCandidateLegal } = await import(pathToFileURL(resolve(process.cwd(), engineTarget)).href);
const cards = JSON.parse(readFileSync(resolve(process.cwd(), catalogTarget), 'utf8')).cards;
const supportAttachmentTypes = new Set(['supportTool', 'supportMascot', 'supportFan']);
const dummy = { number: 'AUDIT-DUMMY', name: 'Audit dummy', jpName: 'Audit dummy', group: 'holomem', stage: 'Debut', hp: 10000, colors: [], tags: [], arts: [{ name: 'Audit damage', damage: 100, cost: [], effect: '' }] };
const oshi = { number: 'AUDIT-OSHI', name: 'Audit oshi', group: 'oshi', colors: [], life: 5, arts: [] };
const pool = [...cards, dummy, oshi];
const inst = (number, id = number) => ({ number, id });
const unit = (number, options = {}) => ({ stack: [inst(number)], cheer: [], attachments: [], damage: 0, rested: false, enteredTurn: 0, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, ...options });
function player(name) {
  return { name, ready: true, setupDone: true, oshi: inst(oshi.number), mainDeck: Array.from({ length: 30 }, (_, i) => inst(dummy.number, `${name}-deck-${i}`)), cheerDeck: [], hand: [], life: Array.from({ length: 5 }, (_, i) => inst('hY01-001', `${name}-life-${i}`)), holoPower: [], archive: [], zones: { center: unit(dummy.number), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null }, collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, turnsTaken: 2, mulliganUsed: false, forcedRedraws: 0 };
}
function state() { return { status: 'playing', players: [player('A'), player('B')], activePlayer: 0, firstPlayer: 0, winner: null, turn: 3, phase: 'main', pendingChoice: null, log: [] }; }
function act(s, action, random = () => 0) { return applyAction(structuredClone(s), 0, action, pool, random); }
const findCard = (predicate, label) => {
  const card = cards.find(predicate);
  assert.ok(card, `Catalog is missing ${label}`);
  return card;
};
const topHolomem = findCard(card => card.group === 'holomem' && card.stage === '1st', '1st Holomem');
const mascot = findCard(card => card.typeCode === 'supportMascot', 'Mascot');
const toolOrFan = findCard(card => supportAttachmentTypes.has(card.typeCode), 'Tool/Mascot/Fan');
const fillerSupport = findCard(card => card.group === 'support' && !supportAttachmentTypes.has(card.typeCode), 'non-attachment Support filler');

const singleColorFirsts = new Map();
for (const card of cards) {
  if (card.group !== 'holomem' || card.stage !== '1st' || card.colors?.length !== 1 || String(card.type || '').toUpperCase().includes('BUZZ')) continue;
  if (!singleColorFirsts.has(card.colors[0])) singleColorFirsts.set(card.colors[0], card);
}
const availableColors = [...singleColorFirsts.keys()];
assert.ok(availableColors.length >= 2, 'Need two single-color non-Buzz 1st cards for the Two-Color Computer regressions');
const colorA = availableColors[0];
const colorB = availableColors.find(color => color !== colorA);
const stageA = findCard(card => card.group === 'holomem' && card.colors?.length === 1 && card.colors[0] === colorA, `${colorA} single-color stage Holomem`);
const stageB = findCard(card => card.group === 'holomem' && card.colors?.length === 1 && card.colors[0] === colorB, `${colorB} single-color stage Holomem`);
const firstA = singleColorFirsts.get(colorA);
const firstB = singleColorFirsts.get(colorB);
const filler = (id) => inst(fillerSupport.number, id);

function twoColorState(deck) {
  const s = state();
  s.players[0].hand = [inst('hBP04-089', 'computer')];
  s.players[0].zones.center = unit(stageA.number);
  s.players[0].zones.back1 = unit(stageB.number);
  s.players[0].mainDeck = deck;
  return s;
}
function selectTwoStageTargets(s, random) {
  s = act(s, { type: 'play', cardId: 'computer' }, random);
  assert.equal(s.pendingChoice?.effect, 'twoColorFirst');
  s = act(s, { type: 'choose', zone: 'center' }, random);
  s = act(s, { type: 'choose', zone: 'back1' }, random);
  return s;
}

test('Two-Color Computer resolves the available second-color search when the first color has no deck match', () => {
  let randomCalls = 0;
  const random = () => { randomCalls += 1; return 0.25; };
  let s = selectTwoStageTargets(twoColorState([inst(firstB.number, 'second-color'), filler('filler-1'), filler('filler-2')]), random);
  assert.equal(s.pendingChoice?.effect, 'twoColorFinish');
  assert.deepEqual(s.pendingChoice.selectableIds, ['second-color']);
  s = act(s, { type: 'choose', cardIds: ['second-color'] }, random);
  assert.equal(s.pendingChoice, null);
  assert.deepEqual(s.players[0].hand.map(card => card.id), ['second-color']);
  assert.equal(randomCalls, 1, 'the combined search shuffles once at completion');
});

test('Two-Color Computer keeps the first-color result when the second color has no deck match', () => {
  let randomCalls = 0;
  const random = () => { randomCalls += 1; return 0.25; };
  let s = selectTwoStageTargets(twoColorState([inst(firstA.number, 'first-color'), filler('filler-1'), filler('filler-2')]), random);
  assert.equal(s.pendingChoice?.effect, 'twoColorFirstSearch');
  assert.deepEqual(s.pendingChoice.selectableIds, ['first-color']);
  s = act(s, { type: 'choose', cardIds: ['first-color'] }, random);
  assert.equal(s.pendingChoice, null);
  assert.deepEqual(s.players[0].hand.map(card => card.id), ['first-color']);
  assert.equal(randomCalls, 1, 'the combined search shuffles once at completion');
});

test('Two-Color Computer still adds both matching colors then shuffles once', () => {
  let randomCalls = 0;
  const random = () => { randomCalls += 1; return 0.25; };
  let s = selectTwoStageTargets(twoColorState([inst(firstA.number, 'first-color'), inst(firstB.number, 'second-color'), filler('filler-1'), filler('filler-2')]), random);
  assert.equal(s.pendingChoice?.effect, 'twoColorFirstSearch');
  s = act(s, { type: 'choose', cardIds: ['first-color'] }, random);
  assert.equal(s.pendingChoice?.effect, 'twoColorFinish');
  s = act(s, { type: 'choose', cardIds: ['second-color'] }, random);
  assert.equal(s.pendingChoice, null);
  assert.deepEqual(s.players[0].hand.map(card => card.id), ['first-color', 'second-color']);
  assert.equal(randomCalls, 1, 'the combined search shuffles once at completion');
});

test('Work Computer requires each available top-four group and bottoms the remainder', () => {
  const s0 = state();
  s0.players[0].hand = [inst('hBP04-090', 'work-computer')];
  s0.players[0].mainDeck = [inst(topHolomem.number, 'holo'), inst(toolOrFan.number, 'gear'), filler('filler-1'), filler('filler-2')];
  let s = act(s0, { type: 'play', cardId: 'work-computer' });
  assert.equal(s.pendingChoice?.effect, 'topLookGrouped');
  assert.equal(s.pendingChoice.optional, false);
  assert.equal(s.pendingChoice.min, 1);
  assert.throws(() => act(s, { type: 'choose', skip: true }));
  s = act(s, { type: 'choose', cardIds: ['holo'] });
  assert.equal(s.pendingChoice?.effect, 'topLookGrouped');
  assert.equal(s.pendingChoice.optional, false);
  assert.equal(s.pendingChoice.min, 1);
  assert.throws(() => act(s, { type: 'choose', skip: true }));
  s = act(s, { type: 'choose', cardIds: ['gear'] });
  assert.equal(s.pendingChoice?.effect, 'bottomOrder');
  s = act(s, { type: 'choose', cardIds: ['filler-2', 'filler-1'] });
  assert.deepEqual(s.players[0].hand.map(card => card.id), ['holo', 'gear']);
  assert.deepEqual(s.players[0].mainDeck.map(card => card.id), ['filler-2', 'filler-1']);
});

test('Mascot Catcher requires its available Mascot search and shuffles after adding it', () => {
  const s0 = state();
  s0.players[0].hand = [inst('hBP04-095', 'mascot-catcher')];
  s0.players[0].mainDeck = [inst(mascot.number, 'mascot'), filler('filler-1'), filler('filler-2')];
  let s = act(s0, { type: 'play', cardId: 'mascot-catcher' });
  assert.equal(s.pendingChoice?.effect, 'deckToHandShuffle');
  // Hidden deck searches keep a UI selection min of zero so that "skip"
  // can be represented, while nonEmptyMin enforces the required pick.
  assert.equal(s.pendingChoice.min, 0);
  assert.equal(s.pendingChoice.nonEmptyMin, 1);
  assert.equal(s.pendingChoice.max, 1);
  assert.equal(s.pendingChoice.optional, false);
  assert.match(s.pendingChoice.prompt, /必須/u);
  assert.doesNotMatch(s.pendingChoice.prompt, /亦可不公開/u);
  assert.equal(isActionCandidateLegal(s, 0, { type: 'choose', skip: true }, pool), false);
  assert.throws(() => act(s, { type: 'choose', skip: true }));
  s = act(s, { type: 'choose', cardIds: ['mascot'] });
  assert.equal(s.pendingChoice, null);
  assert.deepEqual(s.players[0].hand.map(card => card.id), ['mascot']);
  assert.equal(s.players[0].mainDeck.length, 2);
});
