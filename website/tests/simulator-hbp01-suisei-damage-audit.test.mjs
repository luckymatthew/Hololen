import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { pool, state, unit, inst } from './fixtures/simulator-audit.mjs';

const act = (s, action) => applyAction(structuredClone(s), 0, action, pool, () => 0.5);

function stateWithQueuedDamage({ sourceNumber, targetZone, type, targetPlayerIndex = 1, amount = 40 }) {
  const s = state(sourceNumber);
  s.players[0].oshi = inst('hBP01-007', 'suisei-oshi');
  s.players[0].holoPower = [inst('AUDIT-DUMMY', 'power-1'), inst('AUDIT-DUMMY', 'power-2')];
  s.players[targetPlayerIndex].zones[targetZone] = unit('AUDIT-DUMMY', { damage: 0 });
  s.players[1].zones.back1 ||= unit('AUDIT-DUMMY', { damage: 0 });
  s.phase = 'main';
  s.effectQueue = [{
    type,
    playerIndex: 0,
    targetPlayerIndex,
    targetZone,
    sourceZone: 'center',
    damage: amount,
    amount,
    artName: 'Audit hit',
    sourceName: 'Audit hit',
    loseLife: false,
  }];
  return s;
}

test('hBP01-007 normal skill includes its own off-color Suisei Holomen', () => {
  let s = act(stateWithQueuedDamage({ sourceNumber: 'hBP05-036', targetZone: 'back1', type: 'dealArtsDamage' }), { type: 'advance' });
  assert.equal(s.pendingChoice?.effect, 'oshiAfterDamage');
  assert.equal(s.pendingChoice?.meta?.trigger, 'suiseiBack50');
  s = act(s, { type: 'choose', optionId: 'use' });
  assert.equal(s.pendingChoice?.type, 'stageTarget');
  s = act(s, { type: 'choose', zone: 'back1' });
  assert.equal(s.players[1].zones.back1.damage, 90);
  assert.equal(s.players[0].holoPower.length, 0);
});

test('hBP01-007 SP skill can react to blue Holomen special damage to Front', () => {
  let s = act(stateWithQueuedDamage({ sourceNumber: 'hBP01-076', targetZone: 'center', type: 'specialDamage' }), { type: 'advance' });
  assert.equal(s.pendingChoice?.effect, 'oshiAfterDamage');
  assert.equal(s.pendingChoice?.meta?.trigger, 'suiseiMirror');
  assert.equal(s.pendingChoice?.meta?.damage, 40);
  s = act(s, { type: 'choose', optionId: 'use' });
  assert.equal(s.pendingChoice?.type, 'stageTarget');
  s = act(s, { type: 'choose', zone: 'back1' });
  assert.equal(s.players[1].zones.back1.damage, 40);
  assert.equal(s.players[0].spOshiSkillUsed, true);
  assert.equal(s.pendingChoice, null, 'the Oshi-generated follow-up hit must not recursively trigger Suisei’s normal skill');
});

test('hBP01-007 does not trigger when no damage was dealt', () => {
  const s = act(stateWithQueuedDamage({ sourceNumber: 'hBP05-036', targetZone: 'back1', type: 'dealArtsDamage', amount: 0 }), { type: 'advance' });
  assert.equal(s.pendingChoice, null);
});

test('hBP01-007 does not trigger for damage to its own player', () => {
  const s = act(stateWithQueuedDamage({ sourceNumber: 'hBP01-076', targetZone: 'back1', type: 'specialDamage', targetPlayerIndex: 0 }), { type: 'advance' });
  assert.equal(s.pendingChoice, null);
});
