import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, state, inst, unit } from './fixtures/simulator-audit.mjs';

const calliope = cards.find(card => card.group === 'holomem' && card.jpName === '森カリオペ' && !card.keyword);
assert.ok(calliope, 'fixture catalog must contain a non-keyword Mori Calliope');
const attackCard = {
  ...calliope,
  arts: [
    { name: 'Audit Arts A', damage: 20, cost: [], effect: '' },
    { name: 'Audit Arts B', damage: 40, cost: [], effect: '' },
  ],
};
const testCards = [...pool.filter(card => card.number !== calliope.number), attackCard];
const act = (s, playerIndex, action) => applyAction(structuredClone(s), playerIndex, action, testCards, () => .5);

function setup(phase = 'main') {
  const s = state(calliope.number);
  s.phase = phase;
  s.players[0].oshi = inst('hBP02-007');
  s.players[0].holoPower = [inst('AUDIT-DUMMY', 'sp-1'), inst('AUDIT-DUMMY', 'sp-2')];
  s.players[0].zones.center = unit(calliope.number);
  s.players[1].zones.center = unit('AUDIT-DUMMY');
  return s;
}

test('hBP02-007 SP cannot be used before a Mori Calliope Arts resolves', () => {
  assert.throws(() => act(setup(), 0, { type: 'spOshiSkill' }), /反應式推し技能|trigger/i);
});

test('hBP02-007 SP opens after Arts and grants exactly the same Arts one repeat', () => {
  let s = act(setup('performance'), 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
  assert.equal(s.pendingChoice?.effect, 'oshiAfterDamage');
  assert.equal(s.pendingChoice?.meta?.trigger, 'calliopeRepeatArts');

  s = act(s, 0, { type: 'choose', optionId: 'use' });
  assert.equal(s.players[0].spOshiSkillUsed, true);
  assert.equal(s.players[0].zones.center.rested, false);
  const modifier = s.players[0].zones.center.modifiers.find(item => item.kind === 'repeatArts' && item.sourceNumber === 'hBP02-007');
  assert.equal(modifier?.artIndex, 0);
  assert.equal(modifier?.uses, 1);

  assert.throws(() => act(s, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 1 }));
  s = act(s, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
  assert.equal(s.players[1].zones.center.damage, 40);
  assert.equal(s.players[0].zones.center.rested, true);
  assert.equal(s.players[0].zones.center.modifiers.find(item => item.kind === 'repeatArts' && item.sourceNumber === 'hBP02-007')?.uses, 0);
  assert.equal(s.pendingChoice, null);
});
