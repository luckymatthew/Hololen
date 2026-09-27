import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, answer, conserve } from './hbp09-fixtures.mjs';
import { isActionCandidateLegal } from '../lib/simulator/engine.mjs';

const card044 = cards.find(card => card.number === 'hBP09-044');
const redCheer = ['hY03-001', 'hY03-002'];

function artsFixture({ sourceTools = [], otherStageTools = [], target = 'hBP09-044', cheerCount = 2 } = {}) {
  const state = fixture();
  state.turn = 8;
  state.firstPlayer = 1;
  state.activePlayer = 0;
  state.phase = 'performance';
  state.players.forEach(player => { player.turnsTaken = 3; });
  state.players[0].zones.center = unit('hBP09-044');
  state.players[0].zones.center.cheer = redCheer.slice(0, cheerCount).map(instance);
  state.players[0].zones.center.attachments = sourceTools.map(instance);
  if (otherStageTools.length) {
    state.players[0].zones.back1 = unit('hBP09-042');
    state.players[0].zones.back1.attachments = otherStageTools.map(instance);
  }
  state.players[1].zones.center = unit(target);
  return state;
}

test('hBP09-044 official identity, RR/SR/UR printings and Japanese Gift/Arts clauses match the current catalog', () => {
  assert.ok(card044);
  assert.equal(card044.jpName, 'カエラ・コヴァルスキア');
  assert.equal(card044.stage, '2nd');
  assert.equal(card044.hp, 200);
  assert.deepEqual(card044.colors, ['紅']);
  assert.deepEqual(card044.variants.map(variant => variant.id).sort(), [
    'hbp09-hBP09-044_RR',
    'hbp09-hBP09-044_SR',
    'hbp09-hBP09-044_UR',
  ]);
  assert.equal(card044.keyword.name, '師から受け継ぎしもの');
  assert.equal(card044.keyword.effect, "このホロメンにツールが付いているなら、このホロメンは、#カエラ'sアームズを持つツールをもう1枚まで付けられる。");
  assert.equal(card044.arts[0].name, '鍛冶屋の本懐');
  assert.equal(card044.arts[0].damage, 100);
  assert.deepEqual(card044.arts[0].cost, ['紅', '紅']);
  assert.deepEqual(card044.arts[0].specialTargets, ['綠']);
  assert.deepEqual(card044.arts[0].specialValues, [50]);
  assert.equal(card044.arts[0].effect, "このホロメンに#カエラ'sアームズを持つツールが付いているなら、このアーツ+60。");
  assert.equal(cards.find(card => card.number === 'hBP09-107').abilityText, 'このツールが付いている[Buzzか2nd]の〈カエラ・コヴァルスキア〉のアーツ+40。 ツールは、自分のホロメン1人につき1枚だけ付けられる。');
  assert.equal(cards.find(card => card.number === 'hBP09-106').abilityText, 'このツールが付いている[Buzzか2nd]の〈カエラ・コヴァルスキア〉のHP+40。 ツールは、自分のホロメン1人につき1枚だけ付けられる。');
});

test('鍛冶屋の本懐 adds +60 once for Kaela Arms; the equipped Holo Sword separately adds +40', () => {
  for (const [{ sourceTools, otherStageTools }, expected] of [
    [{ sourceTools: [] }, 100],
    [{ sourceTools: ['hBP09-108'] }, 100],
    [{ sourceTools: [], otherStageTools: ['hBP09-106'] }, 100],
    [{ sourceTools: ['hBP09-106'] }, 160],
    [{ sourceTools: ['hBP09-107'] }, 200],
    [{ sourceTools: ['hBP09-106', 'hBP09-107'] }, 200],
  ]) {
    const state = artsFixture({ sourceTools, otherStageTools, target: 'hBP09-042' });
    const before = structuredClone(state);
    const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
    assert.equal(result.players[1].zones.center.damage, expected, JSON.stringify({ sourceTools, otherStageTools }));
    assert.equal(result.players[0].zones.center.rested, true);
    assert.deepEqual(result.players[0].zones.center.cheer.map(card => card.number), redCheer);
    assert.deepEqual(result.players[0].zones.center.attachments.map(card => card.number), sourceTools);
    assert.equal(result.players[0].zones.back1?.attachments?.length || 0, otherStageTools?.length || 0);
    assert.equal(result.pendingChoice, null);
    conserve(before, result);
  }
});

test('the Green Arts icon adds +50 independently of the Arms Tool +60', () => {
  for (const [sourceTools, expected] of [[[], 150], [['hBP09-106'], 210]]) {
    const state = artsFixture({ sourceTools, target: 'hBP09-034' });
    const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
    assert.equal(result.players[1].zones.center.damage, expected);
    assert.equal(result.players[0].zones.center.rested, true);
    assert.deepEqual(result.players[0].zones.center.cheer.map(card => card.number), redCheer);
  }
});

test('鍛冶屋の本懐 cannot be declared without both red Cheer and leaves an incomplete payment untouched', () => {
  const state = artsFixture({ sourceTools: ['hBP09-106'], cheerCount: 1 });
  const before = structuredClone(state);
  const action = { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' };
  assert.equal(isActionCandidateLegal(state, 0, action, cards), false);
  assert.throws(() => act(state, action), /應援不足|Cheer/i);
  assert.deepEqual(state, before);
});

test('師から受け継ぎしもの permits one additional Arms Tool and rejects a third', () => {
  const state = fixture();
  state.turn = 8;
  state.firstPlayer = 1;
  state.activePlayer = 0;
  state.phase = 'main';
  state.players.forEach(player => { player.turnsTaken = 3; });
  state.players[0].zones.center = unit('hBP09-042');
  state.players[0].zones.back1 = unit('hBP09-044');
  const existing = instance('hBP09-108');
  state.players[0].zones.back1.attachments.push(existing);
  const second = instance('hBP09-106');
  state.players[0].hand.push(second);
  const before = structuredClone(state);

  let result = act(state, { type: 'play', cardId: second.id });
  assert.equal(result.pendingChoice?.type, 'attachSupport');
  assert.ok(result.pendingChoice.options.includes('back1'));
  result = answer(result, { zone: 'back1' });
  assert.equal(result.pendingChoice, null);
  assert.deepEqual(new Set(result.players[0].zones.back1.attachments.map(card => card.number)), new Set(['hBP09-108', 'hBP09-106']));
  conserve(before, result);

  const third = instance('hBP09-107');
  result.players[0].hand.push(third);
  const afterTwo = structuredClone(result);
  const thirdPlay = { type: 'play', cardId: third.id };
  assert.equal(isActionCandidateLegal(result, 0, thirdPlay, cards), true, 'the Tool can still be played on a different eligible Holomem');
  const thirdOptions = act(result, thirdPlay);
  assert.equal(thirdOptions.pendingChoice?.type, 'attachSupport');
  assert.ok(thirdOptions.pendingChoice.options.includes('center'));
  assert.ok(!thirdOptions.pendingChoice.options.includes('back1'), 'Kaela-044 cannot receive a third Tool');
  assert.deepEqual(result, afterTwo, 'opening the attachment choice does not mutate the source state');
});
