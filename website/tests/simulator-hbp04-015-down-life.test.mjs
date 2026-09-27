import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pool as fixturePool, dummy, unit, state, attack } from './fixtures/simulator-audit.mjs';

const enginePath = process.env.HOLO_ENGINE_TEST_TARGET || '../lib/simulator/engine.mjs';
const { applyAction } = await import(enginePath);
const catalogPath = resolve(process.cwd(), process.env.HOLO_CARD_CATALOG_TEST_TARGET || 'public/cards.json');
const productionCards = JSON.parse(readFileSync(catalogPath, 'utf8')).cards;
const iris = productionCards.find(card => card.number === 'hBP04-015');
assert.ok(iris?.extra.includes('生命值-2'));
const auditPool = [...fixturePool.filter(card => card.number !== iris.number), iris, { ...dummy, colors: ['綠'] }];

test('hBP04-015 Extra makes a Downed non-Buzz owner lose two Life total', () => {
  const game = state('AUDIT-DUMMY', iris.number);
  game.players[1].zones.center = unit(iris.number, { damage: Math.max(0, iris.hp - 100) });

  const resolved = applyAction(game, 0, attack, auditPool, () => 0);

  assert.equal(resolved.players[1].life.length, 3);
});
