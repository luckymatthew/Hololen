import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, answer } from './hbp09-fixtures.mjs';

const supportNumber = cards.find(card => card.group === 'support')?.number;
assert.ok(supportNumber, 'the official card catalog must contain a Support for Q728');

function battle(target = 'hBP02-064') {
  const state = fixture();
  state.turn = 3;
  state.activePlayer = 0;
  state.phase = 'performance';
  state.players[0].turnEvents = { turn: 3, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  state.players[0].zones.center = unit('hBP01-023');
  state.players[0].zones.center.cheer = Array.from({ length: 3 }, () => instance('hY01-001'));
  state.players[0].zones.collab = unit('hBP09-057');
  state.players[0].zones.collab.cheer = [instance('hY04-001'), instance('hY01-001'), instance('hY01-001')];
  state.players[1].zones.center = unit(target);
  state.players[1].zones.back1 = unit('hBP02-064');
  return state;
}

function attack(state, zone, artIndex, targetZone = 'center', random = () => 0.25) {
  return act(state, { type: 'attack', sourceZone: zone, artIndex, targetZone }, 0, cards, random);
}

test('hBP09-057 first Art does not look at the deck when it is the turn\'s first Arts', () => {
  const state = battle();
  const deckBefore = state.players[0].mainDeck.map(card => card.id);
  const result = attack(state, 'collab', 0);
  assert.equal(result.players[0].turnEvents.arts.length, 1);
  assert.equal(result.pendingChoice, null);
  assert.deepEqual(result.players[0].mainDeck.map(card => card.id), deckBefore);
  assert.equal(result.players[1].zones.center.damage, 70);
});

test('Q728 other Holomem Arts count: Towa gets its Support search as the second Arts and orders all leftovers', () => {
  let state = battle();
  const support = instance(supportNumber);
  const rest = [instance('hBP09-064'), instance('hBP02-064'), instance('hBP09-064')];
  state.players[0].mainDeck = [support, ...rest];

  state = attack(state, 'center', 0, 'center', () => 0.2);
  assert.equal(state.players[0].turnEvents.arts.length, 1, 'the non-Towa Sora Arts event is committed first');
  state = attack(state, 'collab', 0);
  assert.equal(state.pendingChoice?.type, 'cardSelection');
  assert.equal(state.pendingChoice.min, 0);
  assert.equal(state.pendingChoice.max, 1);
  assert.deepEqual(state.pendingChoice.selectableIds, [support.id], 'only the Support among the four looked-at cards is selectable');

  state = answer(state, { cardIds: [support.id] });
  assert.equal(state.pendingChoice?.type, 'cardSelection', 'the three remaining cards must be ordered');
  const orderedRest = [rest[2], rest[0], rest[1]];
  state = answer(state, { cardIds: orderedRest.map(card => card.id) });
  assert.ok(state.players[0].hand.some(card => card.id === support.id));
  assert.deepEqual(state.players[0].mainDeck.map(card => card.id), orderedRest.map(card => card.id));
  assert.ok(state.log.some(entry => (entry.revealRefs || []).some(ref => ref.id === support.id)), 'the selected Support is publicly revealed');
  assert.equal(state.players[0].turnEvents.arts.length, 2);
});

test('Q728 when no Support is among the four looked-at cards, the player orders and bottoms all four', () => {
  let state = battle();
  const looked = ['hBP09-064', 'hBP02-064', 'hBP09-064', 'hBP02-064'].map(number => instance(number));
  state.players[0].mainDeck = looked;
  state = attack(state, 'center', 0, 'center', () => 0.2);
  state = attack(state, 'collab', 0);
  assert.equal(state.pendingChoice?.type, 'cardSelection');
  assert.equal(state.pendingChoice.min, looked.length);
  assert.equal(state.pendingChoice.max, looked.length);
  const order = [looked[3], looked[1], looked[0], looked[2]];
  state = answer(state, { cardIds: order.map(card => card.id) });
  assert.equal(state.players[0].hand.length, 0);
  assert.deepEqual(state.players[0].mainDeck.map(card => card.id), order.map(card => card.id));
  assert.equal(state.pendingChoice, null);
});

test('Q729 two Arts by Sora count toward Towa\'s third-Arts special damage', () => {
  let state = battle('hBP02-064');
  state.players[1].zones.collab = unit('hBP02-064');
  state.players[1].zones.back1 = unit('hBP02-064');

  state = attack(state, 'center', 0, 'center', () => 0);
  assert.ok(state.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'repeatArts' && modifier.uses > 0));
  state = attack(state, 'center', 0, 'center', () => 0.2);
  assert.equal(state.players[0].turnEvents.arts.length, 2);
  assert.equal(state.players[1].zones.center.damage, 160, 'two committed Sora Arts hits count before Towa\'s third Arts');

  state = attack(state, 'collab', 1, 'collab');
  assert.equal(state.players[0].turnEvents.arts.length, 3);
  assert.equal(state.pendingChoice?.type, 'stageTarget');
  assert.ok(state.pendingChoice.options.includes('back1'), 'the special-damage choice includes another opponent Holomem');
  state = answer(state, { zone: 'back1' });
  assert.equal(state.players[1].zones.back1.damage, 50);
  assert.equal(state.players[1].zones.collab.damage, 100, 'Towa\'s 100 Arts damage is separate from the special damage');
  assert.equal(state.players[1].zones.center.damage, 160, 'the special damage does not alter the first two Arts hits');
});

test('hBP09-057 second Art does not deal its conditional special damage before the third Arts', () => {
  let state = battle('hBP02-064');
  state.players[1].zones.back1 = unit('hBP02-064');
  state = attack(state, 'center', 0, 'center', () => 0.2);
  state = attack(state, 'collab', 1, 'center');
  assert.equal(state.players[0].turnEvents.arts.length, 2);
  assert.equal(state.pendingChoice, null);
  assert.equal(state.players[1].zones.back1.damage, 0);
});
