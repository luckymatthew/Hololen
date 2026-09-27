import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, state, unit, attack, fund } from './fixtures/simulator-audit.mjs';

function run(centerNumber) {
  const game = state();
  game.phase = 'performance';
  game.players[0].zones.center = unit(centerNumber);
  game.players[0].zones.collab = unit('hBP01-027');
  fund(game.players[0].zones.collab, cards.find(card => card.number === 'hBP01-027').arts[0].cost);
  game.players[1].zones.center = unit('hBP01-014');
  return applyAction(game, 0, { ...attack, sourceZone: 'collab' }, pool, () => 0);
}

test('hBP01-027 Arts adds +50 only when own Center has #ID', () => {
  assert.equal(run('hBP01-033').players[1].zones.center.damage, 70);
  assert.equal(run('hBP01-026').players[1].zones.center.damage, 120);
});
