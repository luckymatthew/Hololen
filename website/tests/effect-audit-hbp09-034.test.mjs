import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, conserve } from './hbp09-fixtures.mjs';

let serial = 0;
function mioFixture(archiveNumbers = ['hBP01-116', 'hBP01-122', 'hBP09-100', 'hBP09-051']) {
  const state = fixture(1, 64);
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'main';
  const player = state.players[0];
  player.turnsTaken = 3;
  player.turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  player.zones = { center: unit('hBP09-064'), collab: null, back1: unit('hBP09-034'), back2: null, back3: null, back4: null, back5: null };
  player.zones.center.damage = 150;
  player.zones.back1.enteredTurn = 1;
  player.archive = archiveNumbers.map(number => instance(number));
  return state;
}

function collab(state) {
  return act(state, { type: 'collab', zone: 'back1' });
}

function chooseCost(state, ids) {
  const choice = state.pendingChoice;
  assert.equal(choice?.type, 'cardSelection');
  assert.equal(choice.optional, true);
  assert.equal(choice.max, 2);
  assert.equal(choice.min, 2);
  assert.ok(ids.every(id => choice.selectableIds.includes(id)));
  return act(state, { type: 'choose', cardIds: ids }, choice.playerIndex);
}

function healTarget(state, zone) {
  assert.equal(state.pendingChoice?.type, 'stageTarget');
  return act(state, { type: 'choose', zone }, state.pendingChoice.playerIndex);
}

test('hBP09-034 R/SR identity, Buzz Extra, Collab text, Arts cost and damage match catalogue', () => {
  const card = cards.find(entry => entry.number === 'hBP09-034');
  assert.ok(card);
  assert.equal(card.jpName, '大神ミオ');
  assert.equal(card.typeCode, 'buzzCharacter');
  assert.equal(card.stage, '1st');
  assert.equal(card.hp, 240);
  assert.deepEqual(new Set(card.variants.map(variant => variant.rarity)), new Set(['R', 'SR']));
  assert.equal(card.keyword.type, 'collab');
  assert.equal(card.keyword.name, 'ミオしゃの行く道');
  assert.equal(card.keyword.effect, '自分のアーカイブの[マスコットとファン]合計2枚を好きな順でデッキの上に戻せる:自分のホロメン1人のHP100回復。');
  assert.equal(card.extra, 'このホロメンがダウンした時、自分のライフ-2');
  assert.deepEqual(card.arts[0].cost, ['綠', '綠', '無色']);
  assert.equal(card.arts[0].damage, 110);
});

test('Mio optionally returns exactly two archived Mascot/Fan cards in the chosen order and heals one own Holomem by 100', () => {
  const state = mioFixture();
  const owner = state.players[0];
  const mascot = owner.archive.find(card => card.number === 'hBP01-116');
  const fan = owner.archive.find(card => card.number === 'hBP01-122');
  const ineligible = owner.archive.filter(card => ![mascot.id, fan.id].includes(card.id));
  const mainTopAfterCollab = owner.mainDeck[1];
  const cheerTop = owner.cheerDeck[0];
  const before = structuredClone(state);
  let result = collab(state);
  assert.equal(result.pendingChoice?.type, 'cardSelection');
  assert.equal(result.pendingChoice.optional, true);
  assert.equal(result.pendingChoice.min, 2);
  assert.equal(result.pendingChoice.max, 2);
  assert.deepEqual(new Set(result.pendingChoice.selectableIds), new Set([mascot.id, fan.id]));
  result = chooseCost(result, [fan.id, mascot.id]);
  assert.deepEqual(new Set(result.pendingChoice.options), new Set(['center', 'collab']), "the heal can target own Mio but not the opponent or other player's Holomem");
  result = healTarget(result, 'center');
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].zones.center.damage, 50, 'heal 100, bounded by the target’s existing 150 damage');
  assert.deepEqual(result.players[0].mainDeck.slice(0, 3).map(card => card.id), [fan.id, mascot.id, mainTopAfterCollab.id], 'the chosen order is the resulting deck-top order');
  assert.ok(ineligible.every(card => result.players[0].archive.some(current => current.id === card.id)), 'Support Event and Holomem cards are not eligible');
  assert.equal(result.players[0].cheerDeck[0].id, cheerTop.id, 'this effect does not move Cheer');
  conserve(before, result);
});

test('declining the optional two-card cost does not open healing or move/archive cards', () => {
  const state = mioFixture();
  const archiveIds = state.players[0].archive.map(card => card.id);
  const deckIds = state.players[0].mainDeck.map(card => card.id);
  const result = act(collab(state), { type: 'choose', skip: true }, 0);
  assert.equal(result.pendingChoice, null);
  assert.deepEqual(result.players[0].archive.map(card => card.id), archiveIds);
  assert.deepEqual(result.players[0].mainDeck.map(card => card.id), deckIds.slice(1), 'the normal Collab step still moved one deck card to Holo Power');
  assert.equal(result.players[0].zones.center.damage, 150);
});

test('one eligible archived card is insufficient to pay the exact two-card cost', () => {
  const state = mioFixture(['hBP01-116', 'hBP09-100', 'hBP09-051']);
  const eligible = state.players[0].archive.find(card => card.number === 'hBP01-116');
  const result = collab(state);
  assert.equal(result.pendingChoice, null);
  assert.ok(result.players[0].archive.some(card => card.id === eligible.id));
  assert.equal(result.players[0].zones.center.damage, 150);
});

test('Buzz Extra loses exactly two Life when this Mio is Downed by ordinary Arts damage', () => {
  const state = mioFixture([]);
  const attacker = unit('hBP09-034');
  attacker.cheer = [instance('hY02-001'), instance('hY02-001'), instance('hY01-001')];
  const sourceCheerIds = attacker.cheer.map(card => card.id);
  state.players[0].zones = { center: attacker, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  state.players[1].zones = { center: unit('hBP09-034'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  state.players[1].zones.center.damage = 140;
  state.players[0].turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  state.phase = 'performance';
  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  assert.equal(result.players[1].life.length, 3, 'the Buzz Down Extra loses two Life in total');
  assert.ok(result.log.some(entry => JSON.stringify(entry).includes('造成 110 傷害')));
  assert.equal(result.players[0].zones.center.rested, true);
  assert.deepEqual(result.players[0].zones.center.cheer.map(card => card.id), sourceCheerIds, 'Arts cost Cheer stays attached');
});

test('the green-green-colorless 110 Arts cannot be used with only two attached Cheer', () => {
  const state = mioFixture([]);
  const attacker = unit('hBP09-034');
  attacker.cheer = [instance('hY02-001'), instance('hY02-001')];
  state.players[0].zones = { center: attacker, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  state.players[1].zones = { center: unit('hBP09-064'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  state.phase = 'performance';
  const before = structuredClone(state);
  assert.throws(() => act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }), /Arts.*(費用|支付)|費用.*Arts/);
  assert.deepEqual(state, before, 'an illegal Arts cost leaves the state unchanged');
});
