import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, settle } from './hbp09-fixtures.mjs';

const ART = (sourceZone = 'center', targetZone = 'center', artIndex = 0) => ({
  type: 'attack', sourceZone, targetZone, artIndex,
});

function guardFixture({ attacker = 'hBP09-028', targetZone = 'center', priorDamage = 0, covered = false } = {}) {
  const state = fixture();
  state.turn = 7;
  state.activePlayer = 0;
  state.phase = 'performance';
  state.players[0].zones.center = unit(attacker);
  const attackerCard = cards.find(card => card.number === attacker);
  const colorCheer = {
    '白': 'hY01-015', '綠': 'hY02-013', '紅': 'hY03-017',
    '藍': 'hY04-014', '紫': 'hY05-012', '黃': 'hY06-012',
  };
  state.players[0].zones.center.cheer = attackerCard.arts[0].cost.map(color => instance(colorCheer[color] || 'hY01-015'));
  state.players[1].zones.center = unit('hBP09-027');
  state.players[1].zones.center.damage = priorDamage;
  if (targetZone === 'collab') {
    state.players[1].zones.center = unit('hBP09-064');
    state.players[1].zones.collab = unit('hBP09-027');
    state.players[1].zones.collab.damage = priorDamage;
  }
  if (covered) {
    const top = unit('hBP09-028');
    top.stack = [instance('hBP09-027'), instance('hBP09-028')];
    state.players[1].zones.center = top;
  }
  state.players[1].zones.back1 = unit('hBP09-064');
  return state;
}

test('hBP09-027 official card identity and printed Gift/Arts are represented', () => {
  const noel = cards.find(card => card.number === 'hBP09-027');
  assert.ok(noel);
  assert.equal(noel.jpName, '白銀ノエル');
  assert.equal(noel.stage, '1st');
  assert.equal(noel.hp, 160);
  assert.deepEqual(noel.variants.map(variant => variant.rarity).sort(), ['C', 'S']);
  assert.equal(noel.keyword?.type, 'gift');
  assert.equal(noel.keyword?.name, '団長出陣！');
  assert.equal(noel.keyword?.effect, 'このホロメンのHPが減っていないなら、このホロメンが1stホロメンから受けるアーツダメージ-50。');
  assert.equal(noel.arts[0].damage, 40);
  assert.deepEqual(noel.arts[0].cost, ['綠', '無色']);
});

test('hBP09-027 Gift reduces an incoming 1st Arts by 50 to the zero floor while its HP has not decreased', () => {
  const state = guardFixture();
  const result = act(state, ART());
  assert.equal(result.players[1].zones.center.damage, 0, '30 incoming Arts minus 50 must clamp at zero');
  assert.equal(result.players[1].zones.center.stack.at(-1).number, 'hBP09-027');
});

test('hBP09-027 Gift stops reducing Arts as soon as its HP has any damage', () => {
  const state = guardFixture({ priorDamage: 1 });
  const result = act(state, ART());
  assert.equal(result.players[1].zones.center.damage, 31, 'prior damage of 1 disables the condition; full 30 Arts is added');
});

test('hBP09-027 Gift only changes Arts damage from a 1st source, not Debut Arts', () => {
  const state = guardFixture({ attacker: 'hBP09-026' });
  const result = act(state, ART());
  assert.equal(result.players[1].zones.center.damage, 20, 'the Debut Noel deals its full 20 Arts damage');
});

test('hBP09-027 applies in Collab as well as Center, because the printed Gift has no position restriction', () => {
  const state = guardFixture({ targetZone: 'collab' });
  const result = act(state, ART('center', 'collab'));
  assert.equal(result.players[1].zones.collab.damage, 0);
  assert.equal(result.players[1].zones.center.stack.at(-1).number, 'hBP09-064');
});

test('covered hBP09-027 does not reduce Arts for the active higher Bloom card', () => {
  const state = guardFixture({ covered: true });
  const result = act(state, ART());
  assert.equal(result.players[1].zones.center.stack.at(-1).number, 'hBP09-028');
  assert.equal(result.players[1].zones.center.damage, 30, 'the top card has no hBP09-027 Gift');
});

test('special damage from a 1st Holomem is not Arts damage and does not qualify for hBP09-027 Gift', () => {
  const state = guardFixture({ attacker: 'hBP09-054' });
  state.players[0].zones.back1 = unit('hBP09-056'); // 2nd and #歌, enabling the special-damage clause.
  const result = settle(act(state, ART()), cards);
  assert.equal(result.players[1].zones.center.damage, 50, 'the Arts resolves for 30; the preceding 20 special damage is also not reduced');
});
