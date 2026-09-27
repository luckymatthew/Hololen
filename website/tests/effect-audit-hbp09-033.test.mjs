import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, conserve } from './hbp09-fixtures.mjs';

let serial = 0;
function bloomFixture(topCard = 'hBP09-100') {
  const state = fixture(1, 64);
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'main';
  const player = state.players[0];
  player.turnsTaken = 3;
  player.turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  player.zones = { center: unit('hBP09-032'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  player.zones.center.enteredTurn = 1;
  player.hand.push(instance('hBP09-033'));
  if (topCard === null) player.mainDeck = [];
  else player.mainDeck[0] = instance(topCard);
  return state;
}

function bloom(state) {
  const card = state.players[0].hand.find(entry => entry.number === 'hBP09-033');
  assert.ok(card);
  let result = act(state, { type: 'play', cardId: card.id });
  assert.equal(result.pendingChoice?.type, 'bloom');
  result = act(result, { type: 'choose', zone: 'center' });
  assert.equal(result.players[0].zones.center.stack.at(-1).number, 'hBP09-033');
  assert.equal(result.pendingChoice?.type, 'optionChoice');
  return result;
}

function chooseMill(state, optionId) {
  const choice = state.pendingChoice;
  assert.equal(choice?.type, 'optionChoice');
  assert.ok(choice.modeOptions.some(option => option.id === optionId));
  return act(state, { type: 'choose', optionId, option: optionId, mode: optionId }, choice.playerIndex);
}

function chooseStage(state, zone) {
  assert.equal(state.pendingChoice?.type, 'stageTarget');
  return act(state, { type: 'choose', zone }, state.pendingChoice.playerIndex);
}

test('hBP09-033 U/S identity and official Bloom text match the current catalogue', () => {
  const card = cards.find(entry => entry.number === 'hBP09-033');
  assert.ok(card);
  assert.equal(card.jpName, '大神ミオ');
  assert.equal(card.stage, '1st');
  assert.equal(card.hp, 170);
  assert.deepEqual(new Set(card.variants.map(variant => variant.rarity)), new Set(['U', 'S']));
  assert.equal(card.keyword.type, 'bloom');
  assert.equal(card.keyword.name, '濡れ髪ミオしゃ');
  assert.equal(card.keyword.effect, '自分のデッキの上から1枚をアーカイブできる:アーカイブしたカードがサポートなら、自分のエールデッキの上から1枚を自分のホロメンに送る。');
  assert.deepEqual(card.arts[0].cost, ['綠', '無色']);
  assert.equal(card.arts[0].damage, 50);
});

test('paying the optional mill archives exactly a Support, then sends exactly one top Cheer to any own Holomem', () => {
  const state = bloomFixture('hBP09-100');
  state.players[0].zones.back1 = unit('hBP09-034');
  const support = state.players[0].mainDeck[0];
  const nextDeckTop = state.players[0].mainDeck[1];
  const cheerTop = state.players[0].cheerDeck[0];
  const before = structuredClone(state);
  let result = chooseMill(bloom(state), 'yes');
  assert.deepEqual(new Set(result.pendingChoice.options), new Set(['center', 'back1']), 'there is no printed Gamer/tag restriction on the Cheer recipient');
  assert.ok(result.players[0].archive.some(card => card.id === support.id));
  assert.equal(result.players[0].mainDeck[0].id, nextDeckTop.id);
  result = chooseStage(result, 'back1');
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].zones.back1.cheer.at(-1).id, cheerTop.id);
  assert.deepEqual(result.players[0].cheerDeck, before.players[0].cheerDeck.slice(1));
  conserve(before, result);
});

test('paying the mill archives a non-Support too but does not start the conditional Cheer effect', () => {
  const state = bloomFixture('hBP09-051');
  state.players[0].zones.back1 = unit('hBP09-034');
  const milledHolomem = state.players[0].mainDeck[0];
  const cheerBefore = state.players[0].cheerDeck.map(card => card.id);
  let result = chooseMill(bloom(state), 'yes');
  assert.equal(result.pendingChoice, null);
  assert.ok(result.players[0].archive.some(card => card.id === milledHolomem.id));
  assert.equal(result.players[0].cheerDeck.length, cheerBefore.length);
  assert.deepEqual(result.players[0].zones.center.cheer, state.players[0].zones.center.cheer);
  assert.deepEqual(result.players[0].zones.back1.cheer, state.players[0].zones.back1.cheer);
});

test('declining the optional mill leaves the main deck, archive, and Cheer deck untouched', () => {
  const state = bloomFixture('hBP09-100');
  const deckIds = state.players[0].mainDeck.map(card => card.id);
  const archiveIds = state.players[0].archive.map(card => card.id);
  const cheerIds = state.players[0].cheerDeck.map(card => card.id);
  const result = chooseMill(bloom(state), 'no');
  assert.equal(result.pendingChoice, null);
  assert.deepEqual(result.players[0].mainDeck.map(card => card.id), deckIds);
  assert.deepEqual(result.players[0].archive.map(card => card.id), archiveIds);
  assert.deepEqual(result.players[0].cheerDeck.map(card => card.id), cheerIds);
});

test('with no main-deck card, choosing the mill does not archive or fabricate a Support or Cheer', () => {
  const state = bloomFixture(null);
  const result = chooseMill(bloom(state), 'yes');
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].mainDeck.length, 0);
  assert.equal(result.players[0].archive.length, 0);
  assert.equal(result.players[0].cheerDeck.length, 10);
});

test('a Support mill with an empty Cheer deck still resolves the legal destination without adding a Cheer', () => {
  const state = bloomFixture('hBP09-100');
  state.players[0].zones.back1 = unit('hBP09-034');
  state.players[0].cheerDeck = [];
  let result = chooseMill(bloom(state), 'yes');
  assert.deepEqual(new Set(result.pendingChoice.options), new Set(['center', 'back1']));
  result = chooseStage(result, 'back1');
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].zones.back1.cheer.length, 0);
  assert.equal(result.players[0].cheerDeck.length, 0);
});

test('the green 50 Arts requires matching Cheer and settles its normal damage without archiving the cost Cheer', () => {
  const state = bloomFixture('hBP09-100');
  const mio = unit('hBP09-033');
  mio.cheer = [instance('hY02-001'), instance('hY01-015')];
  state.players[0].zones = { center: mio, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  state.players[1].zones.center = unit('hBP09-064');
  state.phase = 'performance';
  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  assert.equal(result.players[1].zones.center.damage, 50);
  assert.equal(result.players[0].zones.center.rested, true);
  assert.deepEqual(new Set(result.players[0].zones.center.cheer.map(card => card.id)), new Set(mio.cheer.map(card => card.id)));
});
