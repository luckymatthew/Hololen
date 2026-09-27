import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, answer, settle } from './hbp09-fixtures.mjs';

const artsAction = { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' };
const cheer = count => Array.from({ length: count }, (_, index) => instance(index < 2 ? 'hY01-015' : 'hY02-013'));

function buffFixture(sourceZone = 'center') {
  const state = fixture();
  state.phase = 'main';
  state.players[0].oshi = instance('hBP07-002');
  state.players[0].holoPower = Array.from({ length: 10 }, () => instance('hY01-001'));
  state.players[0].zones.center = sourceZone === 'center' ? unit('hBP09-023') : unit('hBP09-006');
  state.players[0].zones.collab = sourceZone === 'collab' ? unit('hBP09-023') : null;
  state.players[0].zones.back1 = unit('hBP09-064');
  state.players[0].zones[sourceZone].cheer = cheer(3);
  state.players[1].zones.center = unit('hBP09-023');
  return state;
}

function useZetaOshiOn(state, zone) {
  let result = act(state, { type: 'oshiSkill' }, 0);
  assert.equal(result.pendingChoice?.type, 'stageTarget');
  assert.ok(result.pendingChoice.options.includes(zone));
  result = answer(result, { zone });
  assert.equal(result.players[0].oshiSkillTurn, result.turn);
  return result;
}

test('hBP09-023 center Arts gets its separate +80 after the current-turn Zeta Oshi skill', () => {
  let state = buffFixture('center');
  state = useZetaOshiOn(state, 'back1');
  state.phase = 'performance';
  const result = act(state, artsAction, 0, cards, () => 0.4);
  assert.equal(result.players[1].zones.center.damage, 200, '120 base + 80 card condition; the Oshi skill itself targeted Back, not Zeta');
  assert.equal(result.players[0].zones.center.cheer.length, 3, 'Arts checks two White and one any-color Cheer but does not discard its payment');
  assert.equal(result.players[1].life.length, 5, 'a 200 hit does not down the 220 HP target');
});

test('hBP09-023 collab Arts ignores the bracketed center-only +80 even if the skill was used this turn', () => {
  let state = buffFixture('collab');
  state = useZetaOshiOn(state, 'center');
  state.phase = 'performance';
  const result = act(state, { ...artsAction, sourceZone: 'collab' }, 0, cards, () => 0.4);
  assert.equal(result.players[1].zones.center.damage, 120);
  assert.equal(result.players[0].zones.collab.cheer.length, 3);
});

test('hBP09-023 center Arts stays at 120 if the Oshi skill was not used this turn', () => {
  const state = buffFixture('center');
  state.players[0].oshiSkillTurn = state.turn - 1;
  state.phase = 'performance';
  const result = act(state, artsAction, 0, cards, () => 0.4);
  assert.equal(result.players[1].zones.center.damage, 120);
});

test('hBP09-023 Arts cannot be paid with only its two White Cheer', () => {
  const state = buffFixture('center');
  state.players[0].zones.center.cheer = cheer(2).filter((card, index) => index === 0 || index === 1);
  state.phase = 'performance';
  assert.throws(() => act(state, artsAction, 0, cards, () => 0.4), /應援不足/u);
});

test('hBP09-023 Buzz Extra makes its own Down cost two Life in the complete attack flow', () => {
  const state = fixture();
  state.turn = 4;
  state.activePlayer = 1;
  state.phase = 'performance';
  state.players[0].zones.center = unit('hBP09-023');
  state.players[0].zones.center.damage = 80;
  state.players[0].zones.back1 = unit('hBP09-064');
  state.players[0].life = Array.from({ length: 5 }, () => instance('hY01-001'));
  state.players[1].zones.center = unit('hBP09-022');
  state.players[1].zones.center.cheer = cheer(2);
  state.players[1].zones.back1 = unit('hBP09-064');
  state.players[1].holoPower = Array.from({ length: 4 }, () => instance('hY01-001'));

  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 1, cards, () => 0.4);
  assert.equal(result.players[0].zones.center, null);
  assert.equal(result.players[0].life.length, 3);
  assert.equal(result.lifeLosses.filter(loss => loss.ownerIndex === 0).length, 2);
  const settled = settle(result, cards);
  assert.equal(settled.players[0].life.length, 3);
});

function giftFixture({ oshi = 'hBP07-002', random = () => 0.5 } = {}) {
  const state = fixture();
  state.turn = 3;
  state.activePlayer = 0;
  state.phase = 'performance';
  state.players[0].oshi = instance(oshi);
  state.players[0].zones.center = unit('hBP09-023');
  state.players[0].zones.center.cheer = cheer(3);
  state.players[1].zones.center = unit('hBP09-016');
  state.players[1].zones.collab = null;
  state.players[1].zones.back1 = unit('hBP09-064');
  state.players[0].life = Array.from({ length: 4 }, () => instance('hY01-001'));
  state.players[1].life = Array.from({ length: 4 }, () => instance('hY01-001'));
  return { state, random };
}

test('Q718 Gift does not remove extra Life when the two dice do not equal the pre-Down combined Life total', () => {
  const { state } = giftFixture();
  const result = act(state, artsAction, 0, cards, () => 0);
  assert.deepEqual(result.players[0].turnEvents.dice.map(roll => roll.value), [1, 1]);
  assert.deepEqual(result.lifeLosses.map(loss => loss.sourceName), ['轟一']);
  assert.equal(result.players[1].life.length, 3);
});

test('hBP09-023 Gift does not trigger when the player uses a different Oshi', () => {
  const { state } = giftFixture({ oshi: 'hBP09-022' });
  const result = act(state, artsAction, 0, cards, () => 0.5);
  assert.deepEqual(result.players[0].turnEvents.dice || [], []);
  assert.deepEqual(result.lifeLosses.map(loss => loss.sourceName), ['轟一']);
  assert.equal(result.players[1].life.length, 3);
});
