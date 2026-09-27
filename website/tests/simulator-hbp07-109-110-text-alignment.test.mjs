import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { inst, unit, state, pool, fund, attack } from './fixtures/simulator-audit.mjs';

test('hBP07-109 attaches only to Kronii, permits multiple copies, and adds +10 Arts per fan', () => {
  let game = state('hBP07-052');
  game.phase = 'main';
  game.players[0].zones.back1 = unit('hBP07-077');
  game.players[0].hand = [inst('hBP07-109', 'kronies1'), inst('hBP07-109', 'kronies2')];

  game = applyAction(game, 0, { type: 'play', cardId: 'kronies1' }, pool, () => 0);
  assert.equal(game.pendingChoice.type, 'attachSupport');
  assert.deepEqual(game.pendingChoice.options, ['center']);
  game = applyAction(game, 0, { type: 'choose', zone: 'center' }, pool, () => 0);

  game = applyAction(game, 0, { type: 'play', cardId: 'kronies2' }, pool, () => 0);
  assert.deepEqual(game.pendingChoice.options, ['center']);
  game = applyAction(game, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  game.phase = 'performance';
  fund(game.players[0].zones.center, ['無色']);

  const resolved = applyAction(game, 0, attack, pool, () => 0);
  assert.equal(resolved.players[1].zones.center.damage, 50);
});

test('hBP07-110 attaches only to Nene and draws once when she blooms, including an extra same-turn Bloom', () => {
  let game = state('AUDIT-DUMMY');
  game.phase = 'main';
  game.players[0].zones.back1 = unit('hBP07-077');
  game.players[0].hand = [inst('hBP07-110', 'nekko-fan')];
  game.players[0].mainDeck = [inst('AUDIT-DUMMY', 'draw1'), inst('AUDIT-DUMMY', 'draw2')];
  game.players[0].bonusBloomTurn = game.turn;
  game.players[0].bonusBloomUsedTurn = 0;

  game = applyAction(game, 0, { type: 'play', cardId: 'nekko-fan' }, pool, () => 0);
  assert.equal(game.pendingChoice.type, 'attachSupport');
  assert.deepEqual(game.pendingChoice.options, ['back1']);
  game = applyAction(game, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);

  game.players[0].hand.push(inst('hBP07-080', 'nene-first'), inst('hBP07-082', 'nene-second'));
  game = applyAction(game, 0, { type: 'play', cardId: 'nene-first' }, pool, () => 0);
  assert.equal(game.pendingChoice.type, 'bloom');
  game = applyAction(game, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
  assert.ok(game.players[0].hand.some((card) => card.id === 'draw1'));
  assert.equal(game.players[0].mainDeck[0].id, 'draw2');

  game = applyAction(game, 0, { type: 'play', cardId: 'nene-second' }, pool, () => 0);
  assert.equal(game.pendingChoice.type, 'bloom');
  game = applyAction(game, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
  assert.ok(game.players[0].hand.some((card) => card.id === 'draw1'));
  assert.equal(game.players[0].mainDeck[0].id, 'draw2');
});
