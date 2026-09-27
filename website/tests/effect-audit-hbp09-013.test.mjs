import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, conserve } from './hbp09-fixtures.mjs';

function collabFixture(deck) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'main';
  state.players[0].turnEvents = { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  state.players[0].zones.back1 = unit('hBP09-013');
  state.players[0].mainDeck = deck.map(instance);
  return state;
}

function artsFixture(targetColors) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'performance';
  state.players[0].turnEvents = { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  state.players[0].zones.center = unit('hBP09-013', 3);
  const customCards = cards.map(card => card.number === 'TEST-TARGET' ? { ...card, colors: targetColors } : card);
  return { state, customCards };
}

test('hBP09-013 Collab reveals and adds exactly one named Support, then shuffles the remaining deck', () => {
  const state = collabFixture(['hBP09-051', 'hBP09-094', 'hBP09-099', 'hBP09-098']);
  const before = structuredClone(state);
  const collabTop = state.players[0].mainDeck[0];
  let result = act(state, { type: 'collab', zone: 'back1' });
  assert.equal(result.players[0].zones.collab.stack.at(-1).number, 'hBP09-013');
  assert.equal(result.players[0].holoPower.at(-1).id, collabTop.id, 'ordinary Collab Holo Power placement precedes the search');
  assert.equal(result.pendingChoice?.type, 'cardSelection');
  assert.equal(result.pendingChoice.min, 0, 'hidden-deck card-info search permits fail-to-find under Comprehensive Rules 10.7.2.3.5');
  assert.equal(result.pendingChoice.nonEmptyMin, 1, 'a nonempty result must still satisfy the printed one-card choice');
  assert.equal(result.pendingChoice.optional, false, 'the printed ability remains mandatory even though the hidden search can fail to find');
  assert.equal(result.pendingChoice.max, 1);
  assert.deepEqual(new Set(result.pendingChoice.cards.map(card => card.number)), new Set(['hBP09-094', 'hBP09-099']), 'only the two printed Support names are searchable');

  const selected = result.pendingChoice.cards.find(card => card.number === 'hBP09-099');
  result = act(result, { type: 'choose', cardIds: [selected.id] }, result.pendingChoice.playerIndex);
  assert.equal(result.pendingChoice, null);
  assert.ok(result.players[0].hand.some(card => card.id === selected.id), 'the revealed selected Support enters hand');
  assert.ok(result.players[0].mainDeck.some(card => card.number === 'hBP09-094'), 'the unselected matching Support remains in deck');
  assert.ok(result.players[0].mainDeck.some(card => card.number === 'hBP09-098'), 'a similarly named unrelated Support is not selected');
  assert.ok(!result.players[0].hand.some(card => card.number === 'hBP09-098'));
  assert.notDeepEqual(result.players[0].mainDeck.map(card => card.id), before.players[0].mainDeck.slice(1).filter(card => card.id !== selected.id).map(card => card.id), 'the remaining deck is shuffled after the effect');
  conserve(before, result);
});

test('hBP09-013 Collab may fail to find a matching Support and still completes its search', () => {
  const state = collabFixture(['hBP09-051', 'hBP09-094', 'hBP09-098']);
  const target = state.players[0].mainDeck[1];
  const result = act(state, { type: 'collab', zone: 'back1' });
  assert.equal(result.pendingChoice?.type, 'cardSelection');
  assert.ok(result.pendingChoice.cards.some(card => card.id === target.id));
  assert.equal(result.pendingChoice.min, 0);
  assert.equal(result.pendingChoice.nonEmptyMin, 1);
  assert.equal(result.pendingChoice.optional, false);
  let randomCalls = 0;
  const completed = act(result, { type: 'choose', cardIds: [] }, result.pendingChoice.playerIndex, cards, () => { randomCalls += 1; return 0.4; });
  assert.equal(completed.pendingChoice, null, 'zero selected cards resolve the mandatory search rather than rejecting it');
  assert.ok(completed.players[0].mainDeck.some(card => card.id === target.id), 'failing to find leaves the matching card in the deck');
  assert.ok(!completed.players[0].hand.some(card => card.id === target.id));
  assert.ok(randomCalls > 0, 'the printed post-search shuffle still happens after failing to find');
});

test('hBP09-013 Collab completes without a choice when neither named Support is in deck', () => {
  const state = collabFixture(['hBP09-051', 'hBP09-098', 'hBP09-051']);
  let result = act(state, { type: 'collab', zone: 'back1' });
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].zones.collab.stack.at(-1).number, 'hBP09-013');
  assert.ok(result.players[0].mainDeck.some(card => card.number === 'hBP09-098'));
  assert.equal(result.players[0].hand.some(card => ['hBP09-094', 'hBP09-099'].includes(card.number)), false);
});

test('hBP09-013 Arts gains 50 against red, but not non-red, Holomem', () => {
  const red = artsFixture(['紅']);
  const redResult = act(red.state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, red.customCards);
  assert.equal(redResult.players[1].zones.center.damage, 150, '100 printed damage plus 50 against red');

  const nonRed = artsFixture(['藍']);
  const nonRedResult = act(nonRed.state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, nonRed.customCards);
  assert.equal(nonRedResult.players[1].zones.center.damage, 100, 'non-red targets take only the printed 100');
});
