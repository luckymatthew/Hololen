import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { pool, state, inst } from './fixtures/simulator-audit.mjs';

test('Matsuri die equal to Life resolves deck search before taking the shuffled deck top to Holo Power', () => {
  let game = state();
  game.phase = 'main';
  game.players[0].oshi = inst('hBP06-008', 'matsuri-oshi');
  game.players[0].holoPower = [inst('AUDIT-DUMMY', 'power-1'), inst('AUDIT-DUMMY', 'power-2')];
  game.players[0].mainDeck = [inst('AUDIT-DUMMY', 'searchable-top'), inst('AUDIT-DUMMY', 'deck-next')];

  game = applyAction(game, 0, { type: 'oshiSkill' }, pool, () => 0.67);
  assert.equal(game.pendingChoice?.effect, 'deckToHandShuffle');
  assert.ok(game.pendingChoice.selectableIds.includes('searchable-top'));
  assert.ok(!game.players[0].holoPower.some(card => card.id === 'searchable-top'));
  assert.ok(game.players[0].mainDeck.some(card => card.id === 'searchable-top'));

  game = applyAction(game, 0, { type: 'choose', cardIds: ['searchable-top'] }, pool, () => 0);
  assert.ok(game.players[0].hand.some(card => card.id === 'searchable-top'));
  assert.equal(game.players[0].holoPower.at(-1)?.id, 'deck-next');
  assert.equal(game.players[0].mainDeck.length, 0);
});
