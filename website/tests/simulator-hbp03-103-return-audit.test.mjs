import test from 'node:test';
import assert from 'node:assert/strict';
import { cards, pool, inst, unit, state, attack } from './fixtures/simulator-audit.mjs';
const { applyAction } = await import(process.env.HOLO_ENGINE_TEST_TARGET || '../lib/simulator/engine.mjs');

const korone = cards.find(card => card.jpName === '戌神ころね' && card.stage === 'Debut');
assert.ok(korone);

for (const archivedCopy of [false, true]) test(`Slim Dog returns the exact attached copy before cleanup (older archive copy: ${archivedCopy})`, () => {
  const game = state('AUDIT-DUMMY', korone.number);
  const equippedId = 'equipped-slim-dog';
  const powerId = 'paid-holo-power';
  game.players[1].zones.center = unit(korone.number, {
    damage: Math.max(0, korone.hp - 100),
    attachments: [inst('hBP03-103', equippedId)],
  });
  game.players[1].holoPower = [inst('AUDIT-DUMMY', powerId)];
  if (archivedCopy) game.players[1].archive = [inst('hBP03-103', 'older-slim-dog')];

  const down = applyAction(game, 0, attack, pool, () => 0);
  assert.equal(down.pendingChoice?.effect, 'slimDogReturn');

  const resolved = applyAction(down, 1, { type: 'choose', optionId: 'use' }, pool, () => 0);
  assert.ok(resolved.players[1].hand.some(card => card.id === equippedId));
  assert.ok(resolved.players[1].archive.some(card => card.id === powerId));
  assert.ok(!resolved.players[1].archive.some(card => card.id === equippedId));
  if (archivedCopy) assert.ok(resolved.players[1].archive.some(card => card.id === 'older-slim-dog'));
});

test('each attached Slim Dog resolves independently while its matching Holo Power remains', () => {
  const game = state('AUDIT-DUMMY', korone.number);
  const equippedIds = ['equipped-slim-dog-1', 'equipped-slim-dog-2'];
  const powerIds = ['paid-holo-power-1', 'paid-holo-power-2'];
  game.players[1].zones.center = unit(korone.number, {
    damage: Math.max(0, korone.hp - 100),
    attachments: equippedIds.map(id => inst('hBP03-103', id)),
  });
  game.players[1].holoPower = powerIds.map(id => inst('AUDIT-DUMMY', id));

  let resolved = applyAction(game, 0, attack, pool, () => 0);
  assert.equal(resolved.pendingChoice?.effect, 'slimDogReturn');
  resolved = applyAction(resolved, 1, { type: 'choose', optionId: 'use' }, pool, () => 0);
  assert.equal(resolved.pendingChoice?.effect, 'slimDogReturn');
  resolved = applyAction(resolved, 1, { type: 'choose', optionId: 'use' }, pool, () => 0);
  assert.deepEqual(resolved.players[1].hand.map(card => card.id).sort(), equippedIds.sort());
  assert.ok(powerIds.every(id => resolved.players[1].archive.some(card => card.id === id)));
});
