import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cards, dummy, oshi, unit, state, fund, attack } from './fixtures/simulator-audit.mjs';

const engineModule = await import(process.env.HOLO_ENGINE_TEST_TARGET || '../lib/simulator/engine.mjs');
const catalog = process.env.HOLO_CARD_CATALOG_TEST_TARGET
  ? JSON.parse(readFileSync(resolve(process.cwd(), process.env.HOLO_CARD_CATALOG_TEST_TARGET), 'utf8')).cards
  : cards;
const yellowTarget = { number: 'AUDIT-YELLOW-TARGET', name: 'Audit yellow target', jpName: 'Audit yellow target', group: 'holomem', typeCode: 'character', stage: '2nd', hp: 10000, colors: ['黃'], tags: [], arts: [] };
const pool = [...catalog, dummy, oshi, yellowTarget];
const run = (game, action) => engineModule.applyAction(structuredClone(game), 0, action, pool, () => 0);

test('hBP03-056 Arts 0 adds printed normal and special damage plus its yellow-target +50', () => {
  const game = state('hBP03-056', yellowTarget.number);
  game.players[0].zones.center = unit('hBP03-056');
  game.players[1].zones.center = unit(yellowTarget.number);
  fund(game.players[0].zones.center, catalog.find((card) => card.number === 'hBP03-056').arts[0].cost);
  const result = run(game, attack);
  assert.equal(result.pendingChoice?.effect, 'specialDamage');
  assert.equal(result.pendingChoice?.optional, false);
  const resolved = run(result, { type: 'choose', zone: 'center' });
  assert.equal(resolved.players[1].zones.center.damage, 110);
});

test('hBP03-056 Arts 1 adds printed normal and #歌 special damage plus its yellow-target +50', () => {
  const game = state('hBP03-056', yellowTarget.number);
  game.players[0].zones.center = unit('hBP03-056');
  game.players[0].zones.back1 = unit(cards.find((card) => card.group === 'holomem' && card.tags.includes('#歌')).number);
  game.players[1].zones.center = unit(yellowTarget.number);
  fund(game.players[0].zones.center, catalog.find((card) => card.number === 'hBP03-056').arts[1].cost);
  const result = run(game, { ...attack, artIndex: 1 });
  assert.equal(result.pendingChoice?.effect, 'specialDamage');
  assert.equal(result.pendingChoice?.optional, false);
  const resolved = run(result, { type: 'choose', zone: 'center' });
  assert.equal(resolved.players[1].zones.center.damage, 150);
});
