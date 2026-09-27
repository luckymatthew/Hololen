import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, state, inst, unit } from './fixtures/simulator-audit.mjs';

test('hBP06-023 collab search can select only Buzz Iroha', () => {
  const buzzIroha = cards.find(card => card.jpName === '風真いろは' && card.type?.includes('Buzz'));
  const ordinaryIroha = cards.find(card => card.jpName === '風真いろは' && card.stage === '1st' && !card.type?.includes('Buzz'));
  assert.ok(buzzIroha);
  assert.ok(ordinaryIroha);

  let s = state('hBP06-023');
  s.phase = 'main';
  s.firstPlayer = 0;
  s.activePlayer = 1;
  s.players[1].turnsTaken = 1;
  s.players[1].zones.center = unit('AUDIT-DUMMY');
  s.players[1].zones.back1 = unit('hBP06-023');
  // The collab action moves the deck's current top card to Holo Power, so keep
  // both search candidates below that mandatory card.
  s.players[1].mainDeck = [inst('AUDIT-DUMMY', 'collab-power'), inst(ordinaryIroha.number, 'ordinary-iroha'), inst(buzzIroha.number, 'buzz-iroha')];

  s = applyAction(s, 1, { type: 'collab', zone: 'back1' }, pool, () => 0);

  assert.equal(s.pendingChoice?.effect, 'deckToHandShuffle');
  assert.deepEqual(s.pendingChoice?.cards.map(card => card.id), ['buzz-iroha']);
  assert.deepEqual(s.pendingChoice?.selectableIds, ['buzz-iroha']);

  s = applyAction(s, 1, { type: 'choose', cardIds: ['buzz-iroha'] }, pool, () => 0);
  assert.ok(s.players[1].hand.some(card => card.id === 'buzz-iroha'));
  assert.ok(!s.players[1].hand.some(card => card.id === 'ordinary-iroha'));
  assert.ok(s.players[1].mainDeck.some(card => card.id === 'ordinary-iroha'));
});

test('hBP06-023 collab search is gated to the second player first turn', () => {
  let s = state('hBP06-023');
  s.phase = 'main';
  s.firstPlayer = 1;
  s.activePlayer = 1;
  s.players[1].turnsTaken = 1;
  s.players[1].zones.center = unit('AUDIT-DUMMY');
  s.players[1].zones.back1 = unit('hBP06-023');
  s.players[1].mainDeck = [inst('AUDIT-DUMMY', 'collab-power'), inst('hBP01-051', 'buzz-iroha')];

  s = applyAction(s, 1, { type: 'collab', zone: 'back1' }, pool, () => 0);

  assert.equal(s.pendingChoice, null);
  assert.deepEqual(s.players[1].mainDeck.map(card => card.id), ['buzz-iroha']);
});
