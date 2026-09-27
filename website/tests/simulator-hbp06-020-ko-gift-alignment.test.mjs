import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { pool, state, inst, unit, attack } from './fixtures/simulator-audit.mjs';

test('hBP06-020 opponent-turn KO Gift archives two then draws by distinct Flow Glow names', () => {
  const card = pool.find(entry => entry.number === 'hBP06-020');
  let game = state('AUDIT-DUMMY', 'hBP06-020');
  game.players[1].zones.center = unit('hBP06-020', { damage: Number(card.hp) - 100 });
  game.players[1].zones.back1 = unit('hSD10-010');
  game.players[1].zones.back2 = unit('hSD10-010');
  game.players[1].zones.back3 = unit('hSD11-006');
  game.players[1].mainDeck = [
    inst('AUDIT-DUMMY', 'archive-1'),
    inst('AUDIT-DUMMY', 'archive-2'),
    inst('AUDIT-DUMMY', 'draw-1'),
    inst('AUDIT-DUMMY', 'draw-2'),
    inst('AUDIT-DUMMY', 'remaining'),
  ];

  game = applyAction(game, 0, attack, pool, () => 0);
  assert.equal(game.pendingChoice?.effect, 'giftFlowGlowKo');
  game = applyAction(game, 1, { type: 'choose', optionId: 'use' }, pool, () => 0);

  assert.ok(game.players[1].archive.some(card => card.id === 'archive-1'));
  assert.ok(game.players[1].archive.some(card => card.id === 'archive-2'));
  assert.deepEqual(game.players[1].hand.map(card => card.id), ['draw-1', 'draw-2']);
  assert.deepEqual(game.players[1].mainDeck.map(card => card.id), ['remaining']);
});
