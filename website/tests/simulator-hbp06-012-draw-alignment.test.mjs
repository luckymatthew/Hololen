import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { attack, cards, fund, inst, pool, state } from './fixtures/simulator-audit.mjs';

test('hBP06-012 second Art draws two cards from the owner deck', () => {
  let game = state('hBP06-012');
  const source = game.players[0].zones.center;
  fund(source, cards.find((card) => card.number === 'hBP06-012').arts[1].cost);
  game.players[0].mainDeck = [inst('AUDIT-DUMMY', 'draw-1'), inst('AUDIT-DUMMY', 'draw-2'), inst('AUDIT-DUMMY', 'remaining')];

  game = applyAction(game, 0, { ...attack, artIndex: 1 }, pool, () => 0);

  assert.deepEqual(game.players[0].hand.map((card) => card.id), ['draw-1', 'draw-2']);
  assert.deepEqual(game.players[0].mainDeck.map((card) => card.id), ['remaining']);
});
