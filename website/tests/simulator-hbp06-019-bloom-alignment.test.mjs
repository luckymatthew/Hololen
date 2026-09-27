import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { pool, state, inst } from './fixtures/simulator-audit.mjs';

test('hBP06-019 matching-Oshi Bloom can archive the deck top then draw one', () => {
  let game = state('hBP06-015');
  game.phase = 'main';
  game.players[0].oshi = inst('hBP06-002');
  game.players[0].hand = [inst('hBP06-019', 'bloom')];
  game.players[0].mainDeck = [
    inst('AUDIT-DUMMY', 'archive-top'),
    inst('AUDIT-DUMMY', 'draw-next'),
    inst('AUDIT-DUMMY', 'remaining'),
  ];

  game = applyAction(game, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
  game = applyAction(game, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(game.pendingChoice?.effect, 'genericKeywordMainDeckCost');
  assert.equal(game.pendingChoice?.optional, true);

  game = applyAction(game, 0, { type: 'choose', optionId: 'use' }, pool, () => 0);

  assert.deepEqual(game.players[0].archive.map(card => card.id), ['archive-top']);
  assert.deepEqual(game.players[0].hand.map(card => card.id), ['draw-next']);
  assert.deepEqual(game.players[0].mainDeck.map(card => card.id), ['remaining']);
  assert.equal(game.players[0].turnEvents.deckArchived, 1);
});

test('hBP06-019 Bloom has no effect with a different Oshi', () => {
  let game = state('hBP06-015');
  game.phase = 'main';
  game.players[0].oshi = inst('hBP06-003');
  game.players[0].hand = [inst('hBP06-019', 'bloom')];
  game.players[0].mainDeck = [inst('AUDIT-DUMMY', 'archive-top'), inst('AUDIT-DUMMY', 'draw-next')];

  game = applyAction(game, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
  game = applyAction(game, 0, { type: 'choose', zone: 'center' }, pool, () => 0);

  assert.equal(game.pendingChoice, null);
  assert.deepEqual(game.players[0].archive, []);
  assert.deepEqual(game.players[0].hand, []);
  assert.equal(game.players[0].mainDeck.length, 2);
});
