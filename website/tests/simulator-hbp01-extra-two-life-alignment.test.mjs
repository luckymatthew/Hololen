import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { pool, state, unit, attack } from './fixtures/simulator-audit.mjs';

test('hBP01-027 Buzz Down Extra matches the shared two-Life loss', () => {
  assert.match(pool.find(card => card.number === 'hBP01-027').type, /Buzz/u);
  const game = state('AUDIT-DUMMY', 'hBP01-027');
  game.players[1].zones.center.damage = 999;
  game.players[1].zones.collab = unit('AUDIT-DUMMY');

  const after = applyAction(game, 0, attack, pool, () => 0);

  assert.equal(after.players[1].zones.center, null);
  assert.equal(after.players[1].life.length, 3);
});
