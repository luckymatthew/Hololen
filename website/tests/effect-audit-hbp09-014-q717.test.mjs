import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards as baseCards, instance, unit, act } from './hbp09-fixtures.mjs';

const attacker200 = {
  number: 'AUDIT-ARTS-200', name: 'Audit attacker', jpName: '監査用ホロメン',
  group: 'holomem', stage: '2nd', type: 'Holomen', hp: 240, colors: ['白'], tags: [], baton: 0,
  arts: [{ name: 'Single 200 hit', damage: 200, cost: [], effect: '' }],
};
const cards = [...baseCards, attacker200];
const whiteCheer = () => instance('hY01-015');

function twoHundredAcrossTwoArts() {
  const state = fixture();
  state.turn = 6; state.activePlayer = 0; state.phase = 'performance';
  state.players[0].turnEvents = { turn: 6, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  state.players[0].zones.center = unit('hBP01-014');
  state.players[0].zones.center.cheer = Array.from({ length: 3 }, whiteCheer);
  state.players[0].zones.collab = unit('hBP01-014');
  state.players[0].zones.collab.cheer = Array.from({ length: 3 }, whiteCheer);
  state.players[1].zones.center = unit('hBP09-014', 2);
  return state;
}

test('Q717 hBP09-014 does not aggregate separate Center and Collab Arts damage to 200', () => {
  let state = twoHundredAcrossTwoArts();
  const centerCheerIds = state.players[0].zones.center.cheer.map(card => card.id);
  state = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, cards);
  assert.equal(state.players[1].zones.center.damage, 100);
  assert.equal(state.players[0].zones.center.cheer.length, 3);

  state = act(state, { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' }, 0, cards);
  assert.equal(state.players[0].zones.center.cheer.length, 3, 'two separate 100-damage Arts events do not trigger Subaru');
  assert.deepEqual(state.players[0].zones.center.cheer.map(card => card.id), centerCheerIds);
  assert.ok(!state.players[0].cheerDeck.some(card => centerCheerIds.includes(card.id)), 'the attacker Center Cheers are not returned to the Cheer deck');
  assert.ok(state.players[1].zones.center === null || state.players[1].zones.center.damage >= 200, 'the target still received both independent Arts hits');
});

test('hBP09-014 triggers on one 200 Arts event and returns every opposing Center Cheer in chosen order', () => {
  const state = fixture();
  state.turn = 6; state.activePlayer = 0; state.phase = 'performance';
  state.players[0].turnEvents = { turn: 6, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  state.players[0].zones.center = unit(attacker200.number);
  const centerCheers = [whiteCheer(), whiteCheer(), whiteCheer()];
  state.players[0].zones.center.cheer = centerCheers;
  state.players[1].zones.center = unit('hBP09-014', 2);
  const deckBefore = state.players[0].cheerDeck.map(card => card.id);

  let result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, cards);
  const pending = result.pendingChoice;
  assert.equal(pending?.type, 'lifeCheerTarget', 'rule processing resolves the defeated Subaru and its Life Cheer before waiting Gift abilities');
  result = act(result, { type: 'choose', zone: 'back1' }, pending.playerIndex, cards);
  assert.equal(result.pendingChoice?.type, 'cardSelection');
  assert.deepEqual(result.pendingChoice.selectableIds, centerCheers.map(card => card.id));
  assert.equal(result.pendingChoice.min, centerCheers.length);
  assert.equal(result.pendingChoice.max, centerCheers.length);
  result = act(result, { type: 'choose', cardIds: centerCheers.map(card => card.id).reverse() }, result.pendingChoice.playerIndex, cards);
  assert.equal(result.players[0].zones.center.cheer.length, 0);
  assert.deepEqual(result.players[0].cheerDeck.slice(-3).map(card => card.id), centerCheers.map(card => card.id).reverse());
  assert.deepEqual(result.players[0].cheerDeck.slice(0, deckBefore.length).map(card => card.id), deckBefore);
});

test('hBP09-014 counts an own Holomem Down in the preceding opponent turn even if its sourcePlayerIndex is also the owner', () => {
  const state = fixture();
  state.turn = 8; state.activePlayer = 0; state.phase = 'performance';
  state.players[0].turnEvents = { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  state.players[0].zones.center = unit('hBP09-014');
  state.players[0].zones.center.cheer = Array.from({ length: 3 }, whiteCheer);
  state.knockouts = [{ turn: 7, ownerIndex: 0, sourcePlayerIndex: 0, sourceName: 'opponent-turn triggered effect' }];
  const settled = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  assert.equal(settled.players[1].zones.center.damage, 200, 'the one preceding-turn Down adds exactly 40 to 160');
});

test('hBP09-014 adds 40 once for each own Holomem Down during the preceding opponent turn', () => {
  const state = fixture();
  state.turn = 8; state.activePlayer = 0; state.phase = 'performance';
  state.players[0].turnEvents = { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  state.players[0].zones.center = unit('hBP09-014');
  state.players[0].zones.center.cheer = Array.from({ length: 3 }, whiteCheer);
  state.knockouts = [
    { turn: 7, ownerIndex: 0, sourcePlayerIndex: 0, sourceName: 'own effect during opponent turn' },
    { turn: 7, ownerIndex: 0, sourcePlayerIndex: 1, sourceName: 'opponent attack' },
  ];
  const settled = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  assert.equal(settled.players[1].zones.center.damage, 240, 'two owned Down events add 80 to the printed 160');
});
