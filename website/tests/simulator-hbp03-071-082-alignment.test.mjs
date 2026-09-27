import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pool as fixturePool, dummy, unit, state, fund, attack } from './fixtures/simulator-audit.mjs';

const enginePath = process.env.HOLO_ENGINE_TEST_TARGET || '../lib/simulator/engine.mjs';
const { applyAction } = await import(enginePath);
const productionCatalogPath = resolve(process.cwd(), process.env.HOLO_CARD_CATALOG_TEST_TARGET || 'public/cards.json');
const productionCards = JSON.parse(readFileSync(productionCatalogPath, 'utf8')).cards;
const affectedNumbers = new Set(['hBP03-072', 'hBP03-078']);

const blueTarget = { ...dummy, number: 'AUDIT-BLUE-TARGET', colors: ['藍'] };
const auditPool = [
  ...fixturePool.filter((card) => !affectedNumbers.has(card.number)),
  ...productionCards.filter((card) => affectedNumbers.has(card.number)),
  blueTarget,
];
const blueOpponent = () => unit(blueTarget.number);

test('hBP03-072 adds its six-Cheer +100 and catalogued blue-target +50', () => {
  const current = state('hBP03-072');
  fund(current.players[0].zones.center, Array(6).fill('黃'));
  current.players[1].zones.center = blueOpponent();

  const next = applyAction(current, 0, attack, auditPool, () => 0);

  assert.equal(next.players[1].zones.center.damage, 230);
});

test('hBP03-078 applies its catalogued blue-target +50 independently of the Cheer condition', () => {
  const current = state('hBP03-078');
  fund(current.players[0].zones.center, ['黃', '黃', '黃']);
  current.players[1].zones.center = blueOpponent();

  const next = applyAction(current, 0, attack, auditPool, () => 0);

  assert.equal(next.players[1].zones.center.damage, 100);
});
