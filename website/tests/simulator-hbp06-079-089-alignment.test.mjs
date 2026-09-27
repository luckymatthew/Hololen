import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { pool, state, inst } from './fixtures/simulator-audit.mjs';

test('Favorite Computer only offers a Debut with a matching Buzz and Buzz goods available', () => {
  let game = state();
  game.phase = 'main';
  game.players[0].hand = [inst('hBP06-085', 'computer')];
  game.players[0].mainDeck = [
    inst('hBP01-009', 'debut-without-buzz'),
    inst('hBP01-024', 'zeta-debut'),
    inst('hBP01-027', 'zeta-buzz'),
    inst('hBP07-101', 'buzz-goods'),
  ];

  game = applyAction(game, 0, { type: 'play', cardId: 'computer' }, pool, () => 0);
  assert.deepEqual(game.pendingChoice.cards.map(card => card.id), ['zeta-debut']);

  game = applyAction(game, 0, { type: 'choose', cardIds: ['zeta-debut'] }, pool, () => 0);
  assert.deepEqual(game.pendingChoice.cards.map(card => card.id), ['zeta-buzz']);

  game = applyAction(game, 0, { type: 'choose', cardIds: ['zeta-buzz'] }, pool, () => 0);
  assert.deepEqual(game.pendingChoice.cards.map(card => card.id), ['buzz-goods']);

  game = applyAction(game, 0, { type: 'choose', cardIds: ['buzz-goods'] }, pool, () => 0);
  assert.deepEqual(game.players[0].hand.map(card => card.id).sort(), ['buzz-goods', 'zeta-buzz', 'zeta-debut'].sort());
  assert.ok(game.players[0].archive.some(card => card.id === 'computer'));
  assert.deepEqual(game.players[0].mainDeck.map(card => card.id), ['debut-without-buzz']);
  assert.equal(game.pendingChoice, null);
});

test('Favorite Computer cannot start when the deck has no Buzz goods support', () => {
  const game = state();
  game.phase = 'main';
  game.players[0].hand = [inst('hBP06-085', 'computer')];
  game.players[0].mainDeck = [
    inst('hBP01-024', 'zeta-debut'),
    inst('hBP01-027', 'zeta-buzz'),
  ];

  assert.throws(() => applyAction(game, 0, { type: 'play', cardId: 'computer' }, pool, () => 0));
});
