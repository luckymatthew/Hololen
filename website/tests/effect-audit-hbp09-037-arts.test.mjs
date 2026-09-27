import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act } from './hbp09-fixtures.mjs';
import { effectAuditPending } from '../lib/effect-corrections.mjs';

const yellowTarget = {
  number: 'AUDIT-YELLOW-TARGET', name: 'Audit Yellow Target', jpName: 'Audit Yellow Target',
  group: 'holomem', typeCode: 'character', type: 'Holomen', stage: '1st', hp: 9999,
  colors: ['黃'], tags: [], baton: 0,
  arts: [{ name: 'No-op', damage: 0, cost: [], effect: '' }],
};
const greenTarget = { ...yellowTarget, number: 'AUDIT-GREEN-TARGET', colors: ['綠'] };
const testCards = [...cards, yellowTarget, greenTarget];
const greenTargetUnit = number => ({
  stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false,
  enteredTurn: 0, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0,
});

function artsFixture({ oshi = 'hSD10-001', target = yellowTarget.number, coverBack = false } = {}) {
  const state = fixture();
  state.phase = 'performance';
  const own = state.players[0];
  own.oshi = instance(oshi);
  own.zones.center = unit('hBP09-037');
  own.zones.center.cheer = [instance('hY02-013'), instance('hY02-013'), instance('hY01-015')];
  own.zones.collab = unit('hBP09-036');
  own.zones.collab.cheer = [instance('hY02-013')];
  own.zones.back1 = coverBack
    ? { ...unit('hBP09-031'), stack: [instance('hBP09-030'), instance('hBP09-031')] }
    : unit('hBP09-031');
  own.zones.back2 = unit('hBP01-048'); // Debut is excluded.
  const opponent = state.players[1];
  opponent.zones.center = greenTargetUnit(target);
  return state;
}

test('hBP09-037 R/SR identity, Japanese Arts text, base damage, cost, and yellow bonus match the current catalogue', () => {
  const card = cards.find(entry => entry.number === 'hBP09-037');
  assert.ok(card);
  assert.equal(card.jpName, '輪堂千速');
  assert.equal(card.stage, '2nd');
  assert.equal(card.hp, 200);
  assert.deepEqual(new Set(card.variants.map(variant => variant.rarity)), new Set(['R', 'SR']));
  assert.equal(card.arts[0].effect, '自分の推しホロメンが〈輪堂千速〉なら、自分のステージのDebut以外のホロメン1人につき、このアーツ+30。');
  assert.equal(card.arts[0].damage, 80);
  assert.deepEqual(card.arts[0].cost, ['綠', '綠', '無色']);
  assert.deepEqual(card.arts[0].specialTargets, ['黃']);
  assert.deepEqual(card.arts[0].specialValues, [50]);
});

test('the card detail does not claim official Japanese text is missing after live-source verification', () => {
  assert.equal(effectAuditPending['hBP09-037'], '正式瀏覽器／Android runtime 尚待驗證。');
});

test('Chihaya Oshi Arts counts Center, Collab, and Back once each, excludes Debut, adds the yellow-target bonus, and retains cost Cheer', () => {
  const state = artsFixture();
  const costIds = state.players[0].zones.center.cheer.map(card => card.id);
  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, testCards);
  assert.equal(result.players[1].zones.center.damage, 220, '80 base + 30 for each of three non-Debut stage Holomem + 50 vs Yellow');
  assert.equal(result.players[0].zones.center.rested, true);
  assert.deepEqual(result.players[0].zones.center.cheer.map(card => card.id), costIds, 'Arts Cheer pays the cost without leaving the stage');
});

test('the Arts counts a Bloomed Back Holomem as one current stage unit, not each covered card', () => {
  const state = artsFixture({ target: greenTarget.number, coverBack: true });
  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, testCards);
  assert.equal(result.players[1].zones.center.damage, 170, '80 base + three non-Debut stage Holomem; the covered first-stage card does not count again');
});

test('the +30-per-unit effect is gated by the Chihaya Oshi name while Yellow weakness remains independent', () => {
  const state = artsFixture({ oshi: 'hBP09-001' });
  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, testCards);
  assert.equal(result.players[1].zones.center.damage, 130, '80 base + 50 for a Yellow target, with no Chihaya stage-count bonus');
});

test('the stage-count bonus does not apply to a non-Yellow target without the Oshi gate', () => {
  const state = artsFixture({ target: greenTarget.number });
  state.players[0].oshi = instance('hBP09-001');
  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, testCards);
  assert.equal(result.players[1].zones.center.damage, 80);
});
