import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cards, dummy, oshi, inst, unit, state, fund, attack } from './fixtures/simulator-audit.mjs';

const engineModule = await import(process.env.HOLO_ENGINE_TEST_TARGET || '../lib/simulator/engine.mjs');
const catalog = process.env.HOLO_CARD_CATALOG_TEST_TARGET
  ? JSON.parse(readFileSync(resolve(process.cwd(), process.env.HOLO_CARD_CATALOG_TEST_TARGET), 'utf8')).cards
  : cards;
const greenTarget = { number: 'AUDIT-GREEN-TARGET', name: 'Audit green target', jpName: 'Audit green target', group: 'holomem', typeCode: 'character', stage: '2nd', hp: 10000, colors: ['綠'], tags: [], arts: [] };
const white2ndTarget = { number: 'AUDIT-WHITE-2ND-TARGET', name: 'Audit white 2nd target', jpName: 'Audit white 2nd target', group: 'holomem', typeCode: 'character', stage: '2nd', hp: 10000, colors: ['白'], tags: [], arts: [] };
const pool = [...catalog, dummy, oshi, greenTarget, white2ndTarget];
const run = (game, playerIndex, action) => engineModule.applyAction(structuredClone(game), playerIndex, action, pool, () => 0);

test('hBP03-060 uses its printed +70 condition and green-target +50', () => {
  const game = state('hBP03-060', greenTarget.number);
  game.players[0].zones.center = unit('hBP03-060');
  game.players[1].zones.center = unit(greenTarget.number, { cheer: Array.from({ length: 7 }, (_, i) => inst('hY01-001', `opp-cheer-${i}`)) });
  fund(game.players[0].zones.center, catalog.find((card) => card.number === 'hBP03-060').arts[0].cost);
  const result = run(game, 0, attack);
  assert.equal(result.players[1].zones.center.damage, 190);
});

function hbp03_066Attack() {
  const game = state('hBP03-066', white2ndTarget.number);
  game.players[0].zones.center = unit('hBP03-066', { stack: [inst('hBP03-064', 'under-1st'), inst('hBP03-066', 'hbp03-066-top')] });
  game.players[1].zones.center = unit(white2ndTarget.number);
  fund(game.players[0].zones.center, catalog.find((card) => card.number === 'hBP03-066').arts[0].cost);
  return run(game, 0, attack);
}

test('hBP03-066 white 2nd target gets its catalogued +50 when undercard cost is skipped', () => {
  const result = hbp03_066Attack();
  assert.equal(result.pendingChoice?.effect, 'artUnderCardCost');
  const resolved = run(result, 0, { type: 'choose', skip: true });
  assert.equal(resolved.players[1].zones.center.damage, 170);
});

test('hBP03-066 keeps its printed +50 when a 1st undercard is archived', () => {
  const result = hbp03_066Attack();
  const resolved = run(result, 0, { type: 'choose', cardIds: ['under-1st'] });
  assert.equal(resolved.players[0].archive.some((card) => card.id === 'under-1st'), true);
  assert.equal(resolved.players[1].zones.center.damage, 220);
});

function resolveKoroneMainPhaseSpecialDamage(sourcePlayerIndex) {
  const ownerPlayerIndex = 1;
  const game = state();
  game.activePlayer = sourcePlayerIndex;
  game.phase = 'main';
  game.players[ownerPlayerIndex].zones.center = unit(catalog.find((card) => card.group === 'holomem' && card.jpName === '戌神ころね').number);
  game.players[ownerPlayerIndex].zones.collab = unit('hBP03-065');
  game.pendingChoice = { type: 'optionChoice', playerIndex: sourcePlayerIndex, optional: true, effect: 'auditNoop', modeOptions: [{ id: 'noop', label: 'continue' }], prompt: 'continue', meta: {} };
  game.effectQueue = [{ type: 'specialDamage', playerIndex: sourcePlayerIndex, targetPlayerIndex: ownerPlayerIndex, targetZone: 'center', amount: 20, loseLife: false, sourceName: 'audit', sourceZone: 'center' }];
  return run(game, sourcePlayerIndex, { type: 'choose', skip: true });
}

test('hBP03-065 protects Center Korone from opponent special damage during opponent Main', () => {
  const result = resolveKoroneMainPhaseSpecialDamage(0);
  assert.equal(result.players[1].zones.center.damage, 0);
});

test('hBP03-065 does not block the Korone owner’s own ability damage during their Main', () => {
  const result = resolveKoroneMainPhaseSpecialDamage(1);
  assert.equal(result.players[1].zones.center.damage, 20);
});
