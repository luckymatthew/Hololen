import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act } from './hbp09-fixtures.mjs';
import { publicRoomState } from '../lib/simulator/engine.mjs';

let serial = 0;
function mioCollabFixture(handNumbers = []) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.players[0].turnsTaken = 3;
  state.players[0].turnEvents.turn = state.turn;
  state.players[0].oshi = instance('hBP01-001');
  state.players[0].zones = {
    center: unit('hBP09-064'), collab: null, back1: unit('hBP09-032'), back2: unit('hBP09-034'),
    back3: null, back4: null, back5: null,
  };
  state.players[1].zones = {
    center: unit('hBP09-032'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null,
  };
  state.players[0].hand.push(...handNumbers.map(number => instance(number)));
  return state;
}

function beginCollab(state) {
  return act(state, { type: 'collab', zone: 'back1' });
}

function payCost(state, card) {
  assert.equal(state.pendingChoice?.type, 'cardSelection');
  assert.equal(state.pendingChoice?.optional, true);
  assert.equal(state.pendingChoice?.min, 1);
  assert.equal(state.pendingChoice?.max, 1);
  return act(state, { type: 'choose', cardIds: [card.id] }, state.pendingChoice.playerIndex);
}

function chooseGamer(state, zone) {
  assert.equal(state.pendingChoice?.type, 'stageTarget');
  return act(state, { type: 'choose', zone }, state.pendingChoice.playerIndex);
}

test('hBP09-032 C/S identity and exact Japanese Collab cost/effect match the catalogue', () => {
  const card = cards.find(entry => entry.number === 'hBP09-032');
  assert.ok(card);
  assert.equal(card.jpName, '大神ミオ');
  assert.equal(card.stage, 'Debut');
  assert.equal(card.hp, 100);
  assert.deepEqual(new Set(card.variants.map(variant => variant.rarity)), new Set(['C', 'S']));
  assert.equal(card.keyword.type, 'collab');
  assert.equal(card.keyword.effect, '自分の手札の[マスコットかファン]1枚を公開し、デッキの上に戻せる:自分のエールデッキの上から1枚を自分の#ゲーマーズを持つホロメンに送る。');
  assert.deepEqual(card.arts[0].cost, ['綠']);
  assert.equal(card.arts[0].damage, 20);
});

test('the printed green 20 Arts requires but preserves its attached green Cheer while settling normal attack damage', () => {
  const initial = mioCollabFixture([]);
  const source = unit('hBP09-032');
  const greenCheer = instance('hY02-001');
  source.cheer.push(greenCheer);
  initial.players[0].zones = { center: source, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  initial.phase = 'performance';
  const result = act(initial, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  assert.equal(result.players[1].zones.center.damage, 20);
  assert.equal(result.players[0].zones.center.rested, true);
  assert.ok(result.players[0].zones.center.cheer.some(card => card.id === greenCheer.id), 'CR 1.9.0 §12.3.3.1.1 says Arts cost Cheer is not archived');
});

test('the green 20 Arts rejects a mismatched Cheer without changing the state', () => {
  const initial = mioCollabFixture([]);
  const source = unit('hBP09-032');
  source.cheer.push(instance('hY01-015'));
  initial.players[0].zones = { center: source, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  initial.phase = 'performance';
  const before = structuredClone(initial);
  assert.throws(() => act(initial, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }), /Arts.*(費用|支付)|費用.*Arts/);
  assert.deepEqual(initial, before);
});

test('the cost offers only Mascot/Fan cards and can return exactly one publicly revealed card to deck top', () => {
  const initial = mioCollabFixture(['hBP01-116', 'hBP01-122', 'hBP01-105', 'hBP09-033']);
  const owner = initial.players[0];
  const mascot = owner.hand.find(card => card.number === 'hBP01-116');
  const fan = owner.hand.find(card => card.number === 'hBP01-122');
  const excluded = owner.hand.filter(card => ![mascot.id, fan.id].includes(card.id));
  const previousDeckTop = owner.mainDeck[0].id;
  const nextDeckTop = owner.mainDeck[1].id;
  let result = beginCollab(initial);
  assert.deepEqual(new Set(result.pendingChoice.selectableIds), new Set([mascot.id, fan.id]));
  assert.equal(result.pendingChoice.max, 1, 'the printed cost is exactly one hand card');
  result = payCost(result, mascot);
  assert.equal(result.pendingChoice?.type, 'stageTarget');
  result = chooseGamer(result, 'back2');
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].hand.some(card => card.id === mascot.id), false);
  assert.equal(result.players[0].mainDeck[0].id, mascot.id, 'the paid card is returned to the top of the owner deck');
  assert.equal(result.players[0].mainDeck[1].id, nextDeckTop, 'the post-Collab deck order is not shuffled');
  assert.ok(result.players[0].holoPower.some(card => card.id === previousDeckTop), 'the normal Collab action moved the prior deck top before the ability returns its paid card');
  assert.ok(excluded.every(card => result.players[0].hand.some(current => current.id === card.id)), 'Event and Holomem cards are not eligible costs');
  assert.ok(result.log.some(entry => entry.revealRefs?.some(card => card.id === mascot.id && card.number === mascot.number)), 'the cost card is actually revealed in public battle log');
  const opponentView = publicRoomState(result, 1, cards);
  assert.ok(opponentView.log.some(entry => entry.revealRefs?.some(card => card.id === mascot.id && card.number === mascot.number)), 'opponent can observe the cost reveal');
  assert.deepEqual(result.players[0].zones.back2.cheer.map(card => card.id), [initial.players[0].cheerDeck[0].id]);
});

test('the Fan alternative is paid and the top Cheer can be assigned to another own Gamer', () => {
  const initial = mioCollabFixture(['hBP01-122']);
  const fan = initial.players[0].hand[0];
  const topCheer = initial.players[0].cheerDeck[0].id;
  let result = payCost(beginCollab(initial), fan);
  assert.deepEqual(new Set(result.pendingChoice.options), new Set(['collab', 'back2']));
  result = chooseGamer(result, 'back2');
  assert.equal(result.players[0].zones.back2.cheer[0].id, topCheer);
  assert.equal(result.players[0].zones.collab.cheer.length, 0);
  assert.equal(result.players[1].zones.center.cheer.length, 0, 'an opponent Gamer is not an eligible recipient');
});

test('skipping the optional cost preserves hand and does not send a Cheer', () => {
  const initial = mioCollabFixture(['hBP01-116']);
  const mascot = initial.players[0].hand[0];
  let result = beginCollab(initial);
  result = act(result, { type: 'choose', skip: true }, result.pendingChoice.playerIndex);
  assert.equal(result.pendingChoice, null);
  assert.ok(result.players[0].hand.some(card => card.id === mascot.id));
  assert.ok(!result.players[0].mainDeck.some(card => card.id === mascot.id));
  assert.equal(result.players[0].zones.collab.cheer.length, 0);
  assert.equal(result.players[0].zones.back2.cheer.length, 0);
});

test('without any payable Mascot/Fan, the cost and following Cheer effect do not start', () => {
  const initial = mioCollabFixture(['hBP09-033']);
  const result = beginCollab(initial);
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].hand.length, 1);
  assert.equal(result.players[0].zones.collab.cheer.length, 0);
  assert.equal(result.players[0].zones.back2.cheer.length, 0);
});

test('after paying the legal cost, a valid Gamer target can be selected with an empty Cheer deck and no Cheer is created', () => {
  const initial = mioCollabFixture(['hBP01-116']);
  initial.players[0].cheerDeck = [];
  const mascot = initial.players[0].hand[0];
  const result = chooseGamer(payCost(beginCollab(initial), mascot), 'back2');
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].mainDeck[0].id, mascot.id, 'the already paid pre-colon cost remains resolved');
  assert.equal(result.players[0].zones.collab.cheer.length, 0);
  assert.equal(result.players[0].zones.back2.cheer.length, 0);
});

test('the effect target is an own Gamer only, not another own Holomem or the opponent Gamer', () => {
  const mascot = instance('hBP01-116');
  const initial = mioCollabFixture([]);
  initial.players[0].hand.push(mascot);
  const paid = payCost(beginCollab(initial), mascot);
  assert.deepEqual(new Set(paid.pendingChoice.options), new Set(['collab', 'back2']));
  assert.ok(!paid.pendingChoice.options.includes('center'), 'the non-Gamer own Center is excluded');
  assert.ok(!paid.pendingChoice.options.includes('opponent-center'), 'targets belong to the owner Stage');
});
