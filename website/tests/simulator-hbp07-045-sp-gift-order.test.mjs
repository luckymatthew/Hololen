import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, inst, state, unit } from './fixtures/simulator-audit.mjs';

test('hBP07-045 SP Gift waits until the Oshi deck search finishes', () => {
  const searchCard = cards.find((card) => card.group === 'holomem' && card.colors?.includes('綠'));
  assert.ok(searchCard, 'the card catalogue needs a green Holomem for the SP search');

  const game = state('hBP07-045');
  const player = game.players[0];
  game.phase = 'main';
  player.oshi = inst('hBD24-001');
  player.holoPower = [inst('AUDIT-DUMMY', 'payment-1'), inst('AUDIT-DUMMY', 'payment-2')];
  player.mainDeck = [inst(searchCard.number, 'sp-search'), inst('hY01-001', 'gift-top')];

  let result = applyAction(game, 0, { type: 'spOshiSkill' }, pool, () => 0);
  assert.equal(result.pendingChoice?.effect, 'deckToHandShuffle');
  assert.deepEqual(result.pendingChoice.cards.map((card) => card.id), ['sp-search']);
  assert.deepEqual(result.players[0].mainDeck.map((card) => card.id), ['sp-search', 'gift-top']);
  assert.deepEqual(result.players[0].holoPower, []);

  result = applyAction(result, 0, { type: 'choose', cardIds: ['sp-search'] }, pool, () => 0);
  assert.deepEqual(result.players[0].hand.map((card) => card.id), ['sp-search']);
  assert.deepEqual(result.players[0].holoPower.map((card) => card.id), ['gift-top']);
});
