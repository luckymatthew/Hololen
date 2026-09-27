import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pool, state, unit, fund, attack } from './fixtures/simulator-audit.mjs';

const engineUrl = process.env.HOLO_ENGINE_PATH
  ? pathToFileURL(resolve(process.env.HOLO_ENGINE_PATH))
  : new URL('../lib/simulator/engine.mjs', import.meta.url);
const { applyAction } = await import(engineUrl);

test('hBP05-040 moves the selected Cheer to an own Back Holomem', () => {
  const initial = state('hBP05-040');
  fund(initial.players[0].zones.center, ['無色', '無色', '無色']);
  initial.players[0].zones.back1 = unit('AUDIT-DUMMY');

  let next = applyAction(initial, 0, attack, pool, () => 0);
  assert.equal(next.pendingChoice?.type, 'stageCheerSelection');
  assert.equal(next.pendingChoice?.effect, 'genericMoveCheer');

  next = applyAction(next, 0, { type: 'choose', cheerId: 'cheer0' }, pool, () => 0);
  assert.equal(next.pendingChoice?.type, 'stageTarget');
  assert.equal(next.pendingChoice?.effect, 'genericReceiveMovedCheer');
  assert.deepEqual(next.pendingChoice?.options, ['back1']);

  next = applyAction(next, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
  assert.ok(next.players[0].zones.back1.cheer.some(card => card.id === 'cheer0'));
  assert.equal(next.players[0].zones.center.cheer.some(card => card.id === 'cheer0'), false);
});
