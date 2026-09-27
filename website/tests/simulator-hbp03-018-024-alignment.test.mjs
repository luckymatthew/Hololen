import test from 'node:test';
import assert from 'node:assert/strict';
import { cards, pool, state, unit, inst, fund, attack } from './fixtures/simulator-audit.mjs';
const engineModule = await import(process.env.HOLO_ENGINE_TEST_TARGET || '../lib/simulator/engine.mjs');
const { applyAction } = engineModule;

const blueTarget = { number: 'AUDIT-BLUE-TARGET', name: 'Audit Blue Target', jpName: 'Audit Blue Target', group: 'holomem', typeCode: 'character', stage: '2nd', hp: 10000, colors: ['藍'], tags: [], arts: [] };
const whiteTarget = { number: 'AUDIT-WHITE-TARGET', name: 'Audit White Target', jpName: 'Audit White Target', group: 'holomem', typeCode: 'character', stage: '2nd', hp: 10000, colors: ['白'], tags: [], arts: [] };
const redTarget = { number: 'AUDIT-RED-TARGET', name: 'Audit Red Target', jpName: 'Audit Red Target', group: 'holomem', typeCode: 'character', stage: '2nd', hp: 10000, colors: ['紅'], tags: [], arts: [] };
pool.push(blueTarget, whiteTarget, redTarget);

const act = (game, action) => applyAction(structuredClone(game), 0, action, pool, () => 0);

function damageFor(number, cheerNumbers, targetNumber) {
  const source = unit(number, { cheer: cheerNumbers.map((cheer, index) => inst(cheer, `cheer-${index}`)) });
  const game = state(number, targetNumber);
  game.players[0].zones.center = source;
  game.players[1].zones.center = unit(targetNumber);
  const result = act(game, attack);
  return result.players[1].zones.center.damage;
}

test('hBP03-021 Arts applies its catalogued blue-target +50', () => {
  const art = cards.find((card) => card.number === 'hBP03-021').arts[0];
  const source = unit('hBP03-021');
  fund(source, art.cost);
  const game = state('hBP03-021', blueTarget.number);
  game.players[0].zones.center = source;
  game.players[1].zones.center = unit(blueTarget.number);
  const result = act(game, attack);
  assert.equal(result.players[1].zones.center.damage, art.damage + 50);
});

test('hBP03-024 applies its white-target +50 independently of the non-green-Cheer bonus', () => {
  assert.equal(damageFor('hBP03-024', ['hY02-001', 'hY02-001', 'hY02-001', 'hY02-001'], whiteTarget.number), 150);
  assert.equal(damageFor('hBP03-024', ['hY02-001', 'hY02-001', 'hY04-001', 'hY04-001'], redTarget.number), 150);
});
