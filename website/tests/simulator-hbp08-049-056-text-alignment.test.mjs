import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, isActionCandidateLegal } from '../lib/simulator/engine.mjs';
import { cards, pool, inst, unit, state, fund, attack } from './fixtures/simulator-audit.mjs';

function withBaton(number, baseNumber, baton, overrides = {}) {
  return { ...cards.find(card => card.number === baseNumber), number, baton, hp: 600, ...overrides };
}

test('hBP08-049 Collab Gift restricts normal Arts only while its Center has #FLOW GLOW', () => {
  let s = state();
  s.phase = 'performance';
  s.players[1].zones.center = unit('hBP08-047');
  s.players[1].zones.collab = unit('hBP08-049');
  const centerAttack = { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 };
  const collabAttack = { ...centerAttack, targetZone: 'collab' };

  assert.equal(isActionCandidateLegal(s, 0, centerAttack, pool), false);
  assert.equal(isActionCandidateLegal(s, 0, collabAttack, pool), true);

  s.players[1].zones.center = unit('AUDIT-DUMMY');
  assert.equal(isActionCandidateLegal(s, 0, centerAttack, pool), true, 'without a #FLOW GLOW Center the Gift restriction is inactive');
});

test('hBP08-051 Center Gift adds Baton cost only when a Suu performs Collab', () => {
  let s = state();
  s.phase = 'main';
  s.players[0].zones.center = unit('hBP08-051');
  s.players[0].zones.back1 = unit('hBP08-047');
  s = applyAction(s, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.ok(s.players[1].zones.center.modifiers.some(modifier => modifier.kind === 'batonCost' && modifier.amount === 1 && modifier.expiresTurn === s.turn + 1));

  s = state();
  s.phase = 'main';
  s.players[0].zones.center = unit('AUDIT-DUMMY');
  s.players[0].zones.back1 = unit('hBP08-051');
  s.players[0].zones.back2 = unit('hBP08-047');
  s = applyAction(s, 0, { type: 'collab', zone: 'back2' }, pool, () => 0);
  assert.equal(s.players[1].zones.center.modifiers?.some(modifier => modifier.kind === 'batonCost' && modifier.sourceNumber === 'hBP08-051'), false, 'the printed Center-only condition is enforced');
});

test('hBP08-052 both Arts gain 50 against Red and the first attaches Cheer at Baton cost five', () => {
  const target5 = withBaton('BATON-RED-5', 'hBP08-042', 5, { colors: ['紅'] });
  const target4 = withBaton('BATON-RED-4', 'hBP08-042', 4, { colors: ['紅'] });
  const catalog = [...pool, target5, target4];

  let s = state('hBP08-052', target5.number);
  fund(s.players[0].zones.center, ['藍']);
  s.players[0].cheerDeck = [inst('hY03-001', 'top-cheer')];
  s.players[1].zones.center = unit(target5.number);
  s = applyAction(s, 0, attack, catalog, () => 0);
  assert.equal(s.pendingChoice.type, 'eventCheerTarget');
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, catalog, () => 0);
  assert.equal(s.players[1].zones.center.damage, 120, '70 printed damage plus 50 against Red');
  assert.equal(s.players[0].zones.center.cheer.at(-1).id, 'top-cheer');

  s = state('hBP08-052', target4.number);
  fund(s.players[0].zones.center, ['藍']);
  s.players[0].cheerDeck = [inst('hY03-001', 'unused-cheer')];
  s.players[1].zones.center = unit(target4.number);
  s = applyAction(s, 0, attack, catalog, () => 0);
  assert.equal(s.pendingChoice, null, 'Baton cost four does not offer the Cheer effect');
  assert.equal(s.players[1].zones.center.damage, 120);

  s = state('hBP08-052', target5.number);
  fund(s.players[0].zones.center, ['藍', '無色', '無色', '無色']);
  s.players[1].zones.center = unit(target5.number);
  s = applyAction(s, 0, { ...attack, artIndex: 1 }, catalog, () => 0);
  assert.equal(s.players[1].zones.center.damage, 230, '180 printed damage plus 50 against Red');
});

test('hBP08-053 Center Gift adds two Colorless Arts costs only at Baton cost five', () => {
  const baton5 = withBaton('SUU-BATON-5', 'hBP08-052', 5, { arts: [{ ...cards.find(card => card.number === 'hBP08-052').arts[0], cost: ['藍'] }] });
  const baton4 = withBaton('SUU-BATON-4', 'hBP08-052', 4, { arts: [{ ...cards.find(card => card.number === 'hBP08-052').arts[0], cost: ['藍'] }] });
  const catalog = [...pool, baton5, baton4];
  const candidate = { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 };

  let s = state('hBP08-053', baton5.number);
  s.phase = 'performance';
  s.activePlayer = 1;
  s.players[1].zones.center = unit(baton5.number);
  fund(s.players[1].zones.center, ['藍']);
  assert.equal(isActionCandidateLegal(s, 1, candidate, catalog), false);
  fund(s.players[1].zones.center, ['藍', '無色', '無色']);
  assert.equal(isActionCandidateLegal(s, 1, candidate, catalog), true);

  s = state('hBP08-053', baton4.number);
  s.phase = 'performance';
  s.activePlayer = 1;
  s.players[1].zones.center = unit(baton4.number);
  fund(s.players[1].zones.center, ['藍']);
  assert.equal(isActionCandidateLegal(s, 1, candidate, catalog), true, 'Baton cost four does not add the two-colorless Arts cost');

  s = state();
  s.phase = 'performance';
  s.activePlayer = 1;
  s.players[0].zones.back1 = unit('hBP08-053');
  s.players[1].zones.center = unit(baton5.number);
  s.players[1].zones.center.cheer = [inst('hY04-001', 'blue')];
  assert.equal(isActionCandidateLegal(s, 1, candidate, catalog), true, 'the printed Center-only Gift does not apply from Back');
});

test('hBP08-053 special damage can hit the Center through hBP08-049 Arts redirection', () => {
  const flowCenter = withBaton('FLOW-CENTER-5', 'hBP08-047', 5, { stage: '1st', tags: ['#FLOW GLOW'] });
  const catalog = [...pool, flowCenter];
  let s = state('hBP08-053', flowCenter.number);
  fund(s.players[0].zones.center, ['藍', '藍', '無色']);
  s.players[1].zones.center = unit(flowCenter.number);
  s.players[1].zones.collab = unit('hBP08-049');

  s = applyAction(s, 0, { ...attack, targetZone: 'collab' }, catalog, () => 0);
  assert.equal(s.pendingChoice.effect, 'specialDamage');
  assert.ok(s.pendingChoice.options.includes('center'), `special damage has no normal-Arts collab-only restriction: ${JSON.stringify(s.pendingChoice)}`);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, catalog, () => 0);

  assert.equal(s.players[1].zones.collab.damage, 50, 'the actual Arts attack targets Collab');
  assert.equal(s.players[1].zones.center.damage, 100, 'its separate special damage may target Center');
});

test('hBP08-054 Arts archives exactly three attached Cheer then draws three', () => {
  let s = state('hBP08-054');
  s.players[0].zones.center = unit('hBP08-054', { cheer: [inst('hY01-001', 'c1'), inst('hY02-001', 'c2'), inst('hY03-001', 'c3')] });
  s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'd1'), inst('AUDIT-DUMMY', 'd2'), inst('AUDIT-DUMMY', 'd3'), inst('AUDIT-DUMMY', 'd4')];

  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.pendingChoice.effect, 'genericKeywordCheerCost');
  assert.equal(s.pendingChoice.optional, true);
  for (const cheerId of ['c1', 'c2', 'c3']) s = applyAction(s, 0, { type: 'choose', cheerId }, pool, () => 0);

  assert.deepEqual(s.players[0].archive.map(card => card.id), ['c1', 'c2', 'c3']);
  assert.deepEqual(s.players[0].hand.map(card => card.id), ['d1', 'd2', 'd3']);
  assert.equal(s.players[0].mainDeck.length, 1);
  assert.equal(s.players[1].zones.center.damage, 130);
});

test('hBP08-055 Arts draws only when the source has Red Cheer', () => {
  for (const hasRed of [true, false]) {
    let s = state('hBP08-055');
    s.players[0].zones.center = unit('hBP08-055', { cheer: [inst('hY04-001', 'blue'), ...(hasRed ? [inst('hY03-001', 'red')] : [])] });
    s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'draw')];
    s = applyAction(s, 0, attack, pool, () => 0);
    assert.equal(s.players[0].hand.some(card => card.id === 'draw'), hasRed);
    assert.equal(s.players[1].zones.center.damage, 20);
  }
});

test('hBP08-056 printed Arts damage remains 40', () => {
  let s = state('hBP08-056');
  fund(s.players[0].zones.center, ['無色']);
  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 40);
});

for (const [number, colors, damage] of [
  ['hBP08-049', ['藍', '無色'], 50],
  ['hBP08-050', ['藍'], 20],
  ['hBP08-051', ['藍', '無色'], 40],
]) {
  test(`${number} base Arts damage is ${damage}`, () => {
    let s = state(number);
    fund(s.players[0].zones.center, colors);
    s = applyAction(s, 0, attack, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, damage);
  });
}
