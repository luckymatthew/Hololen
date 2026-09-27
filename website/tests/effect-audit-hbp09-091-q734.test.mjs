import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, instance, cards, act } from './hbp09-fixtures.mjs';

function setup({ oshi = 'hBP07-006', knockouts = [{ turn: 7, ownerIndex: 0, sourcePlayerIndex: 0, sourceName: 'opponent-turn triggered effect' }] } = {}) {
  const state = fixture(6, 64);
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'main';
  state.players[0].oshi = instance(oshi);
  state.players[0].turnEvents.turn = state.turn;
  state.players[0].mainDeck = [
    instance('hBP09-071'), // 1st AZKi
    instance('hBP09-036'), // 1st Iroha
    ...Array.from({ length: 10 }, () => instance('hBP09-051')),
  ];
  state.players[0].hand = [instance('hBP09-091')];
  state.knockouts = knockouts;
  return state;
}

function choose(state, choice) {
  const actor = state.pendingChoice?.playerIndex;
  assert.equal(actor, 0, 'the Support owner must make the search and placement choices');
  return act(state, { type: 'choose', ...choice }, actor);
}

test('hBP09-091 can find and directly stage each available 1st Holomem without a matching prior stage (Q734)', () => {
  let state = setup();
  assert.equal(state.players[0].zones.center.stack[0].number, 'hBP09-064');
  assert.equal(state.players[0].zones.back1, null);
  assert.equal(state.players[0].zones.back2, null);
  const originalDeckIds = state.players[0].mainDeck.map(card => card.id);

  state = act(state, { type: 'play', cardId: state.players[0].hand[0].id });
  assert.equal(state.pendingChoice?.type, 'cardSelection');
  assert.equal(state.pendingChoice.min, 0, 'a hidden-deck search permits declining to find a matching card under CR 10.7.2.3.5');

  const azki = state.pendingChoice.cards.find(card => card.number === 'hBP09-071');
  assert.ok(azki, 'the first search must reveal only the 1st AZKi');
  state = choose(state, { cardIds: [azki.id] });
  assert.equal(state.pendingChoice?.type, 'stageTarget');
  assert.deepEqual(state.pendingChoice.options, ['back1', 'back2', 'back3', 'back4', 'back5']);
  state = choose(state, { zone: 'back1' });

  assert.equal(state.pendingChoice?.type, 'cardSelection');
  assert.equal(state.pendingChoice.min, 0, 'the second hidden-deck search also permits declining to find');
  const iroha = state.pendingChoice.cards.find(card => card.number === 'hBP09-036');
  assert.ok(iroha, 'the second search must reveal only the 1st Iroha');
  state = choose(state, { cardIds: [iroha.id] });
  state = choose(state, { zone: 'back2' });

  assert.equal(state.pendingChoice, null);
  assert.equal(state.players[0].zones.back1.stack.at(-1).number, 'hBP09-071');
  assert.equal(state.players[0].zones.back2.stack.at(-1).number, 'hBP09-036');
  assert.ok(state.players[0].archive.some(card => card.number === 'hBP09-091'));
  assert.equal(state.players[0].mainDeck.length, 10);
  assert.notDeepEqual(state.players[0].mainDeck.map(card => card.id), originalDeckIds.filter(id => ![azki.id, iroha.id].includes(id)), 'after searching both targets, the remaining deck is shuffled');
});

test('hBP09-091 permits failing to find a card in a hidden deck even when a match exists (CR 10.7.2.3.5)', () => {
  let state = setup();
  const originalDeckIds = state.players[0].mainDeck.map(card => card.id);
  state = act(state, { type: 'play', cardId: state.players[0].hand[0].id });
  assert.equal(state.pendingChoice?.type, 'cardSelection');
  assert.ok(state.pendingChoice.cards.some(card => card.number === 'hBP09-071'));
  assert.equal(state.pendingChoice.min, 0);

  state = choose(state, { cardIds: [] });
  assert.equal(state.pendingChoice?.type, 'cardSelection', 'the second, independent deck search still resolves');
  assert.ok(state.pendingChoice.cards.some(card => card.number === 'hBP09-036'));
  assert.equal(state.pendingChoice.min, 0);
  const iroha = state.pendingChoice.cards.find(card => card.number === 'hBP09-036');
  state = choose(state, { cardIds: [iroha.id] });
  const zone = state.pendingChoice.options[0];
  state = choose(state, { zone });

  assert.equal(state.pendingChoice, null);
  assert.ok(state.players[0].mainDeck.some(card => card.number === 'hBP09-071'), 'declined AZKi remains in the deck');
  assert.ok(Object.values(state.players[0].zones).some(unit => unit?.stack.at(-1).number === 'hBP09-036'));
  assert.ok(state.players[0].archive.some(card => card.number === 'hBP09-091'));
  assert.notDeepEqual(state.players[0].mainDeck.map(card => card.id), originalDeckIds.filter(id => id !== iroha.id), 'the remaining deck is shuffled after completing the search sequence');
});

test('hBP09-091 remains unusable without the required Oshi or a Down during the immediately preceding opponent turn', () => {
  for (const options of [
    { oshi: 'hBP09-001' },
    { knockouts: [] },
  ]) {
    const state = setup(options);
    const before = structuredClone(state);
    assert.throws(() => act(state, { type: 'play', cardId: state.players[0].hand[0].id }));
    assert.deepEqual(state, before, 'illegal support play must be rejected before any card or counter moves');
  }
});
