import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pool as fixturePool, dummy, unit, state, fund, attack } from './fixtures/simulator-audit.mjs';

const enginePath = process.env.HOLO_ENGINE_TEST_TARGET || '../lib/simulator/engine.mjs';
const { applyAction } = await import(enginePath);
const catalogPath = resolve(process.cwd(), process.env.HOLO_CARD_CATALOG_TEST_TARGET || 'public/cards.json');
const productionCards = JSON.parse(readFileSync(catalogPath, 'utf8')).cards;
const numbers = new Set(['hBP04-013', 'hBP04-014', 'hBP02-024']);
const greenTarget = { ...dummy, number: 'AUDIT-GREEN-TARGET', colors: ['綠'] };
const auditPool = [
  ...fixturePool.filter(card => !numbers.has(card.number)),
  ...productionCards.filter(card => numbers.has(card.number)),
  greenTarget,
];

test('hBP04-013 applies its catalogued green-target +50', () => {
  const game = state('hBP04-013', greenTarget.number);
  fund(game.players[0].zones.center, productionCards.find(card => card.number === 'hBP04-013').arts[0].cost);

  const resolved = applyAction(game, 0, attack, auditPool, () => 0);

  assert.equal(resolved.players[1].zones.center.damage, 210);
});

test('hBP04-014 adds its Gamer condition once and its catalogued green-target +50', () => {
  const game = state('hBP04-014', greenTarget.number);
  game.players[0].zones.back1 = unit('hBP02-024');
  fund(game.players[0].zones.center, productionCards.find(card => card.number === 'hBP04-014').arts[0].cost);

  const resolved = applyAction(game, 0, attack, auditPool, () => 0);

  assert.equal(resolved.players[1].zones.center.damage, 200);
});
