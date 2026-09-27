import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act } from './hbp09-fixtures.mjs';

const towa = cards.find(card => card.number === 'hBP09-052');

function collabFixture({ firstPlayer = 1, turnsTaken = 1, cheer = true } = {}) {
  const state = fixture();
  state.turn = firstPlayer === 0 ? 1 : 2;
  state.firstPlayer = firstPlayer;
  state.activePlayer = 0;
  state.phase = 'main';
  const own = state.players[0];
  own.turnsTaken = turnsTaken;
  own.zones = {
    center: unit('hBP09-051'),
    collab: null,
    back1: unit('hBP09-052'),
    back2: null,
    back3: null,
    back4: null,
    back5: null,
  };
  own.zones.center.cheer = [];
  own.cheerDeck = cheer ? [instance('hY04-014'), instance('hY01-015')] : [];
  state.players[1].zones.center = unit('hBP09-052');
  state.players[1].zones.back1 = unit('hBP09-052');
  own.turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  return state;
}

function collab(state) {
  return act(state, { type: 'collab', zone: 'back1' });
}

test('official hBP09-052 identity and Japanese Collab text match the current catalogue', () => {
  assert.ok(towa);
  assert.equal(towa.jpName, '常闇トワ');
  assert.equal(towa.group, 'holomem');
  assert.equal(towa.stage, 'Debut');
  assert.equal(towa.hp, 130);
  assert.deepEqual(towa.colors, ['藍']);
  assert.deepEqual(towa.variants.map(variant => variant.rarity), ['U']);
  assert.equal(towa.keyword?.type, 'collab');
  assert.equal(towa.keyword?.name, '配信終わりのひととき');
  assert.equal(towa.keyword?.effect, '自分が後攻で最初のターンなら、自分のエールデッキの上から1枚を自分の〈常闇トワ〉に送る。');
  assert.equal(towa.arts[0].damage, 30);
  assert.deepEqual(towa.arts[0].cost, ['無色']);
});

test('second player first turn attaches exactly the top Cheer to a selected own Towa', () => {
  let state = collab(collabFixture());
  assert.equal(state.pendingChoice?.type, 'stageTarget');
  assert.deepEqual(state.pendingChoice?.options, ['center', 'collab'], 'only own Towa units can receive the Cheer');
  const [topCheerId, nextCheerId] = state.players[0].cheerDeck.map(card => card.id);
  state = act(state, { type: 'choose', zone: 'center' }, state.pendingChoice.playerIndex);
  assert.equal(state.pendingChoice, null);
  assert.equal(state.players[0].zones.center.cheer[0]?.id, topCheerId);
  assert.deepEqual(state.players[0].cheerDeck.map(card => card.id), [nextCheerId]);
  assert.equal(state.players[1].zones.center.cheer.length, 0);
  assert.equal(state.players[1].zones.back1.cheer.length, 0);
});

test('with an empty Cheer Deck, resolve the legal Towa target and do not create Cheer', () => {
  let state = collab(collabFixture({ cheer: false }));
  assert.equal(state.pendingChoice?.type, 'stageTarget', 'a legal target is still selected before the unavailable Cheer send is attempted');
  assert.deepEqual(state.pendingChoice.options, ['center', 'collab']);
  state = act(state, { type: 'choose', zone: 'center' }, state.pendingChoice.playerIndex);
  assert.equal(state.pendingChoice, null);
  assert.equal(state.players[0].zones.center.cheer.length, 0);
  assert.equal(state.players[0].zones.collab.cheer.length, 0);
  assert.equal(state.players[0].cheerDeck.length, 0);
});

test('the Collab effect is limited to the second player’s first turn', () => {
  for (const [firstPlayer, turnsTaken] of [[0, 1], [1, 2]]) {
    const state = collab(collabFixture({ firstPlayer, turnsTaken }));
    assert.equal(state.pendingChoice, null, `firstPlayer=${firstPlayer}, turnsTaken=${turnsTaken}`);
    assert.equal(state.players[0].cheerDeck.length, 2);
    assert.equal(state.players[0].zones.center.cheer.length, 0);
  }
});
