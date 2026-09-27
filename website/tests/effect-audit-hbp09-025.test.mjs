import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act } from './hbp09-fixtures.mjs';

function noelDefenseFixture(oshiNumber) {
  const state = fixture();
  state.turn = 6;
  state.activePlayer = 0;
  state.phase = 'performance';
  state.players[0].zones.center = unit('hBP09-023');
  state.players[0].zones.center.cheer = Array.from({ length: 3 }, () => instance('hY01-015'));
  state.players[1].oshi = instance(oshiNumber);
  state.players[1].zones.center = unit('hBP09-025');
  state.players[1].zones.center.damage = 10;
  state.players[1].zones.back1 = unit('hBP09-064');
  return state;
}

function attackNoel(state) {
  return act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, cards);
}

test('hBP09-025 official identity, Gift text, and C/S printings match the local catalog', () => {
  const noel = cards.find(card => card.number === 'hBP09-025');
  assert.ok(noel);
  assert.equal(noel.jpName, '白銀ノエル');
  assert.equal(noel.stage, 'Debut');
  assert.equal(noel.hp, 130);
  assert.deepEqual(noel.variants.map(variant => variant.rarity).sort(), ['C', 'S']);
  assert.equal(noel.keyword?.type, 'gift');
  assert.equal(noel.keyword?.name, 'カジュアルノエル');
  assert.equal(noel.keyword?.effect, '自分の推しホロメンが推しステージスキルを持つなら、このホロメンのHP+20。');
  assert.equal(noel.arts[0].damage, 20);
  assert.deepEqual(noel.arts[0].cost, ['無色']);
});

test('hBP09-025 Gift adds 20 effective HP with a Stage Skill Oshi, preventing an exact-threshold Down', () => {
  const state = noelDefenseFixture('hBP09-003');
  assert.ok(cards.find(card => card.number === 'hBP09-003')?.stageSkill);
  const result = attackNoel(state);
  assert.equal(result.players[1].zones.center.stack.at(-1).number, 'hBP09-025');
  assert.equal(result.players[1].zones.center.damage, 130);
  assert.equal(result.players[1].zones.center.damage < 150, true, '120 Arts damage plus 10 prior damage leaves 20 HP against 150 effective HP');
});

test('hBP09-025 Gift grants no HP when the Oshi has no Stage Skill', () => {
  const state = noelDefenseFixture('hBP09-006');
  assert.equal(Boolean(cards.find(card => card.number === 'hBP09-006')?.stageSkill), false);
  const result = attackNoel(state);
  assert.equal(result.players[1].zones.center, null, '130 total damage Downs 130 HP Noel when the Oshi has no Stage Skill');
});

test('hBP09-025 Gift stops applying when Noel is covered by a higher Bloom card', () => {
  const state = noelDefenseFixture('hBP09-003');
  const covered = unit('hBP09-028');
  covered.stack = [instance('hBP09-025'), instance('hBP09-028')];
  covered.damage = 30;
  state.players[1].zones.center = covered;
  const result = attackNoel(state);
  assert.equal(result.players[1].zones.center, null, 'top hBP09-028 has 150 HP; the covered hBP09-025 Gift does not raise that threshold');
});
