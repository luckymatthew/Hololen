import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { pool, inst, state, unit } from './fixtures/simulator-audit.mjs';

function bloomMioWithOtherBack(hasOtherBack) {
  let game = state('AUDIT-DUMMY');
  game.phase = 'main';
  game.players[0].zones.back1 = unit('hBP07-024');
  if (hasOtherBack) game.players[0].zones.back2 = unit('hBP07-026');
  game.players[0].hand = [inst('hBP07-027', 'bloom')];
  game = applyAction(game, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
  return applyAction(game, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
}

test('hBP07-027 Bloom buffs one other own Back Holomen, never its own source', () => {
  const game = bloomMioWithOtherBack(true);

  assert.equal(game.pendingChoice?.type, 'stageTarget');
  assert.equal(game.pendingChoice?.effect, 'addModifier');
  assert.equal(game.pendingChoice?.optional, false);
  assert.deepEqual(game.pendingChoice?.options, ['back2']);
  assert.equal(game.players[0].zones.back1.modifiers.some((modifier) => modifier.sourceNumber === 'hBP07-027'), false);

  const resolved = applyAction(game, 0, { type: 'choose', zone: 'back2' }, pool, () => 0);
  assert.equal(resolved.players[0].zones.back1.modifiers.some((modifier) => modifier.sourceNumber === 'hBP07-027'), false);
  assert.ok(resolved.players[0].zones.back2.modifiers.some((modifier) => modifier.kind === 'arts' && modifier.amount === 30 && modifier.expiresTurn === resolved.turn));
});

test('hBP07-027 Bloom does not buff its source when no other own Back Holomen exists', () => {
  const game = bloomMioWithOtherBack(false);

  assert.equal(game.pendingChoice, null);
  assert.equal(game.players[0].zones.back1.modifiers.some((modifier) => modifier.sourceNumber === 'hBP07-027'), false);
});
