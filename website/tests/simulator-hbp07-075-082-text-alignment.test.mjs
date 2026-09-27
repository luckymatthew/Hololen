import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, inst, unit, state, fund } from './fixtures/simulator-audit.mjs';

const act = (s, playerIndex, action, random = () => 0) => applyAction(s, playerIndex, action, pool, random);

test('hBP07-075 counts every Cheer in both Archives only at three attached Cheer', () => {
  const run = (attachedCount) => {
    const s = state('hBP07-075', 'AUDIT-DUMMY');
    s.players[0].zones.center.cheer = Array.from({ length: attachedCount }, (_, i) => inst('hY05-001', `attached-${i}`));
    s.players[0].archive = [inst('hY01-001', 'own-archive-1'), inst('hY04-001', 'own-archive-2')];
    s.players[1].archive = [inst('hY02-001', 'opponent-archive-1'), inst('hY03-001', 'opponent-archive-2')];
    return act(s, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
  };

  assert.equal(run(3).players[1].zones.center.damage, 110);
  assert.equal(run(2).players[1].zones.center.damage, 70);
});

test('hBP07-075 Gift ignores a matching Arts reduction from its own Archive color', () => {
  const s = state('hBP07-075', 'hBP03-015');
  fund(s.players[0].zones.center, ['紫', '紫', '紫']);
  s.players[0].archive = [inst('hY01-001', 'matching-white-cheer')];
  s.players[1].zones.collab = unit('hBP03-015');
  const after = act(s, 0, { type: 'attack', sourceZone: 'center', targetZone: 'collab', artIndex: 0 });
  assert.equal(after.players[1].zones.collab.damage, 80);
});

test('hBP07-076 Arts offers optional Holo Power archive cost for +30 damage', () => {
  const makeState = () => {
    const s = state('hBP07-076', 'AUDIT-DUMMY');
    fund(s.players[0].zones.center, ['紫', '無色']);
    s.players[0].holoPower = [inst('AUDIT-DUMMY', 'nerissa-power')];
    return s;
  };
  const skipped = act(makeState(), 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
  assert.equal(skipped.pendingChoice.effect, 'artHoloPowerCost');
  assert.equal(skipped.pendingChoice.optional, true);
  const skipDone = act(skipped, 0, { type: 'choose', skip: true });
  assert.equal(skipDone.players[1].zones.center.damage, 50);
  assert.equal(skipDone.players[0].holoPower.length, 1);

  const paid = act(makeState(), 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
  const paidDone = act(paid, 0, { type: 'choose', cardIds: ['nerissa-power'] });
  assert.equal(paidDone.players[1].zones.center.damage, 80);
  assert.equal(paidDone.players[0].holoPower.length, 0);
  assert.equal(paidDone.players[0].archive.at(-1).id, 'nerissa-power');
});

test('hBP07-079 Bloom lets its Cheer attach only to the new Bloom source', () => {
  let s = state();
  s.phase = 'main';
  s.players[0].zones.center = unit('hBP07-078', { enteredTurn: 1 });
  s.players[0].hand = [inst('hBP07-079', 'nene-bloom')];
  s.players[0].archive = [inst('hY01-001', 'nene-archived-cheer')];

  s = act(s, 0, { type: 'play', cardId: 'nene-bloom' });
  s = act(s, 0, { type: 'choose', zone: 'center' });
  assert.equal(s.pendingChoice.type, 'cardSelection');
  assert.equal(s.pendingChoice.optional, true);
  assert.deepEqual(s.pendingChoice.cards.map((card) => card.id), ['nene-archived-cheer']);

  s = act(s, 0, { type: 'choose', cardIds: ['nene-archived-cheer'] });
  assert.equal(s.pendingChoice.type, 'stageTarget');
  assert.deepEqual(s.pendingChoice.options, ['center']);
  s = act(s, 0, { type: 'choose', zone: 'center' });
  assert.equal(s.players[0].zones.center.cheer.at(-1).id, 'nene-archived-cheer');
  assert.equal(s.players[0].archive.length, 0);
});

test('hBP07-080 Nene Gift attaches an archived Nekko to its source once per turn', () => {
  const neneOshi = cards.find((card) => card.group === 'oshi' && card.jpName === '桃鈴ねね');
  const nekko = cards.find((card) => card.jpName === 'ねっ子' || card.name === 'ねっ子');
  assert.ok(neneOshi && nekko);
  let s = state();
  s.phase = 'main';
  s.players[0].zones.center = unit('hBP07-080');
  s.players[0].oshi = inst(neneOshi.number, 'nene-oshi');
  s.players[0].archive = [inst(nekko.number, 'archived-nekko')];

  s = act(s, 0, { type: 'giftSkill', zone: 'center' });
  assert.equal(s.pendingChoice.effect, 'giftNekkoPick');
  s = act(s, 0, { type: 'choose', cardIds: ['archived-nekko'] });
  assert.equal(s.pendingChoice.type, 'attachArchivedSupport');
  assert.deepEqual(s.pendingChoice.options, ['center']);
  s = act(s, 0, { type: 'choose', zone: 'center' });
  assert.equal(s.players[0].zones.center.attachments.at(-1).id, 'archived-nekko');
  assert.equal(s.players[0].archive.length, 0);
  assert.throws(() => act(s, 0, { type: 'giftSkill', zone: 'center' }));
});

test('hBP07-081 with Girafa splits Arts damage between both opposing front slots', () => {
  const s = state('hBP07-081', 'AUDIT-DUMMY');
  fund(s.players[0].zones.center, ['黃', '黃']);
  s.players[0].zones.center.attachments = [inst('hBP07-103', 'girafa')];
  s.players[1].zones.collab = unit('AUDIT-DUMMY');
  const after = act(s, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
  assert.equal(after.players[1].zones.center.damage, 50);
  assert.equal(after.players[1].zones.collab.damage, 50);
});

test('hBP07-082 Arts adds its blue-target bonus and keeps base damage on other colors', () => {
  const run = (targetNumber) => {
    const s = state('hBP07-082', targetNumber);
    fund(s.players[0].zones.center, ['無色']);
    return act(s, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
  };
  assert.equal(run('hBP01-081').players[1].zones.center.damage, 100);
  assert.equal(run('hBP04-086').players[1].zones.center.damage, 50);
});
