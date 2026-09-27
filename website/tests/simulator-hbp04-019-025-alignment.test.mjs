import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pool as fixturePool, dummy, unit, state, fund } from './fixtures/simulator-audit.mjs';

const enginePath = process.env.HOLO_ENGINE_TEST_TARGET || '../lib/simulator/engine.mjs';
const { applyAction, isActionCandidateLegal } = await import(enginePath);
const catalogPath = resolve(process.cwd(), process.env.HOLO_CARD_CATALOG_TEST_TARGET || 'public/cards.json');
const productionCards = JSON.parse(readFileSync(catalogPath, 'utf8')).cards;
const redTarget = { ...dummy, number: 'AUDIT-RED-TARGET', colors: ['紅'] };
const whiteTarget = { ...dummy, number: 'AUDIT-WHITE-TARGET', colors: ['白'] };
const productionNumbers = new Set(['hBP04-016', 'hBP04-019', 'hBP04-020', 'hBP04-025']);
const pool = [
  ...fixturePool.filter(card => !productionNumbers.has(card.number)),
  ...productionCards.filter(card => productionNumbers.has(card.number)),
  redTarget,
  whiteTarget,
];

test('hBP04-019 Arts applies its Center-tag +80 and catalogued red-target +50', () => {
  const game = state('hBP04-016', redTarget.number);
  game.players[0].zones.collab = unit('hBP04-019');
  fund(game.players[0].zones.collab, fixturePool.find(card => card.number === 'hBP04-019').arts[0].cost);

  const resolved = applyAction(game, 0, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 }, pool, () => 0);

  assert.equal(resolved.players[1].zones.center.damage, 200);
});

test('hBP04-019 Arts keeps the red-target +50 without an own #絵 Center', () => {
  const game = state('hBP04-020', redTarget.number);
  game.players[0].zones.collab = unit('hBP04-019');
  fund(game.players[0].zones.collab, fixturePool.find(card => card.number === 'hBP04-019').arts[0].cost);

  const resolved = applyAction(game, 0, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 }, pool, () => 0);

  assert.equal(resolved.players[1].zones.center.damage, 120);
});

test('hBP04-019 collab-only Arts cannot be declared from Center', () => {
  const game = state('hBP04-019', redTarget.number);
  fund(game.players[0].zones.center, productionCards.find(card => card.number === 'hBP04-019').arts[0].cost);
  const action = { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 };

  assert.equal(isActionCandidateLegal(game, 0, action, pool), false);
  assert.throws(() => applyAction(game, 0, action, pool, () => 0));
});

test('hBP04-025 applies its white-target +50 without the separate Raden Oshi condition', () => {
  const game = state('hBP04-025', whiteTarget.number);
  fund(game.players[0].zones.center, fixturePool.find(card => card.number === 'hBP04-025').arts[0].cost);

  const resolved = applyAction(game, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);

  assert.equal(resolved.players[1].zones.center.damage, 190);
});
