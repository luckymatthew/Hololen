import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { pool, state, inst } from './fixtures/simulator-audit.mjs';

function attackWithTool(unitNumber, toolNumber, cheerNumbers) {
  const game = state(unitNumber);
  game.phase = 'performance';
  game.players[0].zones.center.attachments = [inst(toolNumber, 'tool')];
  game.players[0].zones.center.cheer = cheerNumbers.map((number, index) => inst(number, `cheer-${index}`));
  return applyAction(game, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
}

test('hBP05-081 grants its extra Arts 20 only to first-or-higher Noel with at least three Cheer', () => {
  const threeCheer = attackWithTool('hBP02-015', 'hBP05-081', ['hY01-001', 'hY02-001', 'hY03-001']);
  const twoCheer = attackWithTool('hBP02-015', 'hBP05-081', ['hY01-001', 'hY02-001']);

  assert.equal(threeCheer.players[1].zones.center.damage, 60, '30 printed +10 base Tool +20 conditional Tool effect');
  assert.equal(twoCheer.players[1].zones.center.damage, 40, 'without the three-Cheer condition only the base +10 applies');
});

test('hBP05-082 grants Arts +40 to second-or-higher Aki in addition to the base +10', () => {
  const result = attackWithTool('hBP01-037', 'hBP05-082', ['hY02-001', 'hY02-001', 'hY02-001']);

  assert.equal(result.players[1].zones.center.damage, 170, '70 printed +50 Aki Art +10 base Tool +40 conditional Tool effect');
});
