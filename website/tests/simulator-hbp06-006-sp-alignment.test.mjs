import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, state, unit, inst } from './fixtures/simulator-audit.mjs';

const id1 = cards.find(card => card.group === 'holomem' && card.tags?.includes('#ID1期生'));

test('Moona SP moves revealed Cheer directly to ID1 Holomen without firing an archive-only Gift', () => {
  assert.ok(id1, 'the fixture must include an #ID1期生 Holomen');
  let game = state();
  game.phase = 'main';
  game.activePlayer = 0;
  game.players[0].oshi = inst('hBP06-006', 'moona-oshi');
  game.players[0].holoPower = [inst('AUDIT-DUMMY', 'power-1'), inst('AUDIT-DUMMY', 'power-2')];
  game.players[0].zones.center = unit('hBP08-031');
  game.players[0].zones.center.cheer = [inst('hY01-001', 'own-cheer-1'), inst('hY01-001', 'own-cheer-2'), inst('hY01-001', 'own-cheer-3')];
  game.players[0].zones.collab = unit(id1.number);
  game.players[1].zones.center.cheer = [inst('hY01-001', 'opp-cheer-1'), inst('hY01-001', 'opp-cheer-2'), inst('hY01-001', 'opp-cheer-3')];
  game.players[0].cheerDeck = [inst('hY02-001', 'revealed-cheer')];

  game = applyAction(game, 0, { type: 'spOshiSkill' }, pool, () => 0);
  assert.equal(game.pendingChoice?.effect, 'oshiCheerDeckDistribute');
  game = applyAction(game, 0, { type: 'choose', cardIds: ['revealed-cheer'] }, pool, () => 0);

  assert.equal(game.players[0].hand.length, 0, 'a Cheer sent from the Cheer Deck to the Stage was not archived by the card text');
  assert.equal(game.pendingChoice?.effect, 'attachArchiveCheer');
  game = applyAction(game, 0, { type: 'choose', zone: 'collab' }, pool, () => 0);

  assert.equal(game.players[0].zones.collab.cheer.at(-1)?.id, 'revealed-cheer');
  assert.equal(game.players[0].hand.length, 0);
});
