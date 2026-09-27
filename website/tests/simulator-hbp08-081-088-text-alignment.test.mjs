import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, dummy, inst, unit, state, fund, attack } from './fixtures/simulator-audit.mjs';

const holomem = predicate => cards.find(card => card.group === 'holomem' && predicate(card));

test('hBP08-081 Center Arts scales by the exact Cheer lead', () => {
  for (const [lead, expected] of [[0, 40], [1, 60], [2, 80]]) {
    let s = state('hBP08-081');
    fund(s.players[0].zones.center, ['黃', '無色']);
    s.players[0].zones.back1 = unit('hBP08-078', { cheer: Array.from({ length: lead }, (_, i) => inst('hY01-001', `own-${i}`)) });
    s.players[1].zones.center.cheer = [inst('hY01-001', 'op-0'), inst('hY01-001', 'op-1')];
    s = applyAction(s, 0, attack, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, expected, `Cheer lead ${lead}`);
  }
});

test('hBP08-081 Center-only Arts is rejected from Collab', () => {
  let s = state('AUDIT-DUMMY');
  s.players[0].zones.collab = unit('hBP08-081');
  fund(s.players[0].zones.collab, ['黃', '無色']);
  assert.throws(() => applyAction(s, 0, { ...attack, sourceZone: 'collab' }, pool, () => 0), /不能從目前位置使用/u);
});

test('hBP08-082 Arts applies its printed White-target bonus', () => {
  const whiteTarget = { ...dummy, number: 'AUDIT-WHITE-082', colors: ['白'] };
  let s = state('hBP08-082');
  fund(s.players[0].zones.center, ['黃', '無色']);
  s.players[1].zones.center = unit(whiteTarget.number);
  s = applyAction(s, 0, attack, [...pool, whiteTarget], () => 0);
  assert.equal(s.players[1].zones.center.damage, 150);
});

for (const [ownCount, opposingCount, expected] of [[2, 2, 0], [3, 2, 40]]) {
  test(`hBP08-082 Collab grants +40 only when own stage Cheer is greater (${ownCount}/${opposingCount})`, () => {
    let s = state('AUDIT-DUMMY');
    s.phase = 'main';
    s.players[0].zones.back1 = unit('hBP08-082');
    s.players[0].zones.center.cheer = Array.from({ length: ownCount }, (_, i) => inst('hY01-001', `own-${i}`));
    s.players[1].zones.center.cheer = Array.from({ length: opposingCount }, (_, i) => inst('hY01-001', `op-${i}`));
    s = applyAction(s, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(s.players[0].zones.collab.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 40), expected === 40);
  });
}

test('hBP08-083 Arts gains +20 per Cheer above the opponent', () => {
  for (const [lead, expected] of [[0, 120], [1, 140], [3, 180]]) {
    let s = state('hBP08-083');
    fund(s.players[0].zones.center, ['黃', '黃', '無色']);
    s.players[0].zones.back1 = unit('hBP08-078', { cheer: Array.from({ length: lead }, (_, i) => inst('hY01-001', `own-${i}`)) });
    s.players[1].zones.center.cheer = [inst('hY01-001', 'op-0'), inst('hY01-001', 'op-1'), inst('hY01-001', 'op-2')];
    s = applyAction(s, 0, attack, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, expected, `Cheer lead ${lead}`);
  }
});

test('hBP08-083 Bloom offers archive Cheer only when own stage Cheer is not greater', () => {
  const cheer = cards.find(card => card.group === 'cheer');
  assert.ok(cheer);
  let s = state('hBP03-081');
  s.phase = 'main';
  fund(s.players[0].zones.center, ['黃']);
  fund(s.players[1].zones.center, ['紫']);
  s.players[0].hand = [inst('hBP08-083', 'bloom')];
  s.players[0].archive = [inst(cheer.number, 'archive-cheer')];
  s = applyAction(s, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.pendingChoice?.effect, 'archiveCheerToStage');
  assert.equal(s.pendingChoice.optional, true);
  assert.equal(s.pendingChoice.min, 0);
  assert.equal(s.pendingChoice.max, 1);
  s = applyAction(s, 0, { type: 'choose', cardIds: ['archive-cheer'] }, pool, () => 0);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.players[0].zones.center.cheer.some(instance => instance.id === 'archive-cheer'), true);

  s = state('hBP03-081');
  s.phase = 'main';
  fund(s.players[0].zones.center, ['黃', '白']);
  fund(s.players[1].zones.center, ['紫']);
  s.players[0].hand = [inst('hBP08-083', 'bloom')];
  s.players[0].archive = [inst(cheer.number, 'archive-cheer')];
  s = applyAction(s, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.pendingChoice, null, 'one more own Cheer suppresses the optional Archive effect');
});

test('hBP08-084 Arts bonus requires a 2nd #1期生 on the own stage', () => {
  const secondGen = holomem(card => card.stage === '2nd' && card.tags.includes('#1期生'));
  const firstGenFirst = holomem(card => card.stage === '1st' && card.tags.includes('#1期生'));
  assert.ok(secondGen && firstGenFirst);
  for (const [supporter, expected] of [[secondGen.number, 60], [firstGenFirst.number, 30]]) {
    let s = state('hBP08-084');
    fund(s.players[0].zones.center, ['無色']);
    s.players[0].zones.back1 = unit(supporter);
    s = applyAction(s, 0, attack, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, expected);
  }
});

for (const [lifeCount, expected] of [[3, true], [4, false]]) {
  test(`hBP08-084 Collab buffs #1期生 only at three or fewer Life (${lifeCount})`, () => {
    const eligible = holomem(card => card.stage === '2nd' && card.tags.includes('#1期生'));
    const ineligible = holomem(card => card.group === 'holomem' && !card.tags.includes('#1期生'));
    let s = state(ineligible.number);
    s.phase = 'main';
    s.players[0].life = s.players[0].life.slice(0, lifeCount);
    s.players[0].zones.back1 = unit('hBP08-084');
    s.players[0].zones.center = unit(eligible.number);
    s.players[0].zones.back2 = unit(ineligible.number);
    s = applyAction(s, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(s.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 20), expected);
    assert.equal(s.players[0].zones.back2.modifiers.some(modifier => modifier.kind === 'arts'), false);
  });
}

test('hBP08-085 basic Arts uses its printed one-Colorless cost and 10 damage', () => {
  let s = state('hBP08-085');
  fund(s.players[0].zones.center, ['無色']);
  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 10);
});

test('hBP08-086 Arts checks the own Center stage, regardless of its source zone', () => {
  const second = holomem(card => card.stage === '2nd' && card.number !== 'hBP08-086');
  assert.ok(second);
  for (const [center, expected] of [[second.number, 50], ['AUDIT-DUMMY', 20]]) {
    let s = state('AUDIT-DUMMY');
    s.players[0].zones.center = unit(center);
    s.players[0].zones.collab = unit('hBP08-086');
    fund(s.players[0].zones.collab, ['無色']);
    s = applyAction(s, 0, { ...attack, sourceZone: 'collab' }, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, expected);
  }
});

test('hBP08-086 Bloom sends Cheer only to own Flare or #EN', () => {
  const flareDebut = cards.find(card => card.number === 'hBP05-063');
  const enDebut = holomem(card => card.stage === 'Debut' && card.tags.includes('#EN'));
  const otherDebut = holomem(card => card.stage === 'Debut' && !card.tags.includes('#EN') && !card.jpName.includes('不知火フレア'));
  const cheer = cards.find(card => card.group === 'cheer');
  assert.ok(flareDebut && enDebut && otherDebut && cheer);
  let s = state(flareDebut.number);
  s.phase = 'main';
  s.players[0].zones.back1 = unit(enDebut.number);
  s.players[0].zones.back2 = unit(otherDebut.number);
  s.players[0].hand = [inst('hBP08-086', 'bloom')];
  s.players[0].cheerDeck = [inst(cheer.number, 'top-cheer')];
  s = applyAction(s, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.pendingChoice?.type, 'eventCheerTarget');
  assert.equal(s.pendingChoice?.options.includes('center'), true);
  assert.equal(s.pendingChoice?.options.includes('back1'), true);
  assert.equal(s.pendingChoice?.options.includes('back2'), false);
  s = applyAction(s, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
  assert.equal(s.players[0].zones.back1.cheer.some(instance => instance.id === 'top-cheer'), true);
});

test('hBP08-087 Collab attaches one or two archived Cheer to an eligible Center only', () => {
  const cheer = cards.find(card => card.group === 'cheer');
  const enCenter = holomem(card => card.stage === '1st' && card.tags.includes('#EN'));
  assert.ok(cheer && enCenter);
  let s = state(enCenter.number);
  s.phase = 'main';
  s.players[0].zones.back1 = unit('hBP08-087');
  s.players[0].zones.back2 = unit('hBP08-086');
  s.players[0].archive = [inst(cheer.number, 'cheer-1'), inst(cheer.number, 'cheer-2')];
  s = applyAction(s, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.equal(s.pendingChoice?.effect, 'archiveCheerToStage');
  assert.equal(s.pendingChoice.optional, true);
  assert.equal(s.pendingChoice.min, 0);
  assert.equal(s.pendingChoice.max, 2);
  s = applyAction(s, 0, { type: 'choose', cardIds: ['cheer-1', 'cheer-2'] }, pool, () => 0);
  assert.deepEqual(s.pendingChoice.options, ['center']);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.players[0].zones.center.cheer.filter(instance => ['cheer-1', 'cheer-2'].includes(instance.id)).length, 1);
  assert.deepEqual(s.pendingChoice?.options, ['center']);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.players[0].zones.center.cheer.filter(instance => ['cheer-1', 'cheer-2'].includes(instance.id)).length, 2);
});

test('hBP08-088 Collab Gift deals 20 special damage to both opposing front positions', () => {
  let s = state();
  s.phase = 'main';
  s.players[0].zones.back1 = unit('hBP08-088');
  s.players[1].zones.center = unit('hBP08-085');
  s.players[1].zones.collab = unit('hBP08-087');
  s = applyAction(s, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 20);
  assert.equal(s.players[1].zones.collab.damage, 20);
});
