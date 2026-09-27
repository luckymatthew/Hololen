import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, answer, support } from './hbp09-fixtures.mjs';

function giftFixture({ centerDamage = 210, back1Damage = 180 } = {}) {
  const state = fixture(6, 64);
  state.turn = 8;
  state.phase = 'main';
  state.players[0].turnsTaken = 3;
  state.players[0].turnEvents.turn = state.turn;
  state.players[0].zones = {
    center: unit('hBP09-031'), collab: null,
    back1: unit('hBP09-031'), back2: unit('hBP09-030'),
    back3: null, back4: null, back5: null,
  };
  state.players[0].zones.center.damage = centerDamage;
  state.players[0].zones.back1.damage = back1Damage;
  state.players[0].zones.back2.damage = 100;
  return state;
}

function artsFixture({ oshi = 'hBP09-003', sourceDamage = 20, target = 'hBP09-029' } = {}) {
  const state = fixture(6, 64);
  state.turn = 8;
  state.phase = 'performance';
  state.activePlayer = 0;
  state.players[0].turnsTaken = 3;
  state.players[0].turnEvents.turn = state.turn;
  state.players[0].oshi = instance(oshi);
  state.players[0].zones = {
    center: unit('hBP09-031'), collab: null,
    back1: null, back2: null, back3: null, back4: null, back5: null,
  };
  state.players[0].zones.center.damage = sourceDamage;
  state.players[0].zones.center.cheer = Array.from({ length: 4 }, () => instance('hY02-013'));
  state.players[1].zones = {
    center: unit(target), collab: null,
    back1: null, back2: null, back3: null, back4: null, back5: null,
  };
  return state;
}

function useNoelGyudon(state, zone) {
  state = support(state, 100);
  assert.equal(state.pendingChoice?.effect, 'hbp09');
  return answer(state, { ref: 'noel', zone });
}

function useArchiveCountCollabOnNoel(state) {
  const gyudon = state.players[0].mainDeck.pop();
  assert.ok(gyudon);
  gyudon.number = 'hBP09-100';
  state.players[0].archive.push(gyudon);
  state.players[0].zones.back1 = unit('hBP09-030');
  state.players[0].zones.center = unit('hBP09-031');
  state.players[0].zones.center.damage = 210;
  state = act(state, { type: 'collab', zone: 'back1' });
  assert.equal(state.pendingChoice?.type, 'healDistribution');
  assert.equal(state.pendingChoice.count, 1);
  return answer(state, { allocations: { center: 1 } });
}

test('hBP09-031 official RR/SR/UR identity, Gift text, Arts text, costs and target modifier match the catalogue', () => {
  const card = cards.find(entry => entry.number === 'hBP09-031');
  assert.ok(card);
  assert.equal(card.jpName, '白銀ノエル');
  assert.equal(card.stage, '2nd');
  assert.equal(card.hp, 220);
  assert.deepEqual(new Set(card.variants.map(variant => variant.rarity)), new Set(['RR', 'SR', 'UR']));
  assert.equal(card.keyword.type, 'gift');
  assert.equal(card.keyword.effect, '[ターンに1回]このホロメンが〈牛丼〉の能力で回復するHP+100。');
  assert.equal(card.arts[0].damage, 10);
  assert.deepEqual(card.arts[0].cost, ['綠', '綠', '綠', '無色']);
  assert.deepEqual(card.arts[0].specialTargets, ['藍']);
  assert.deepEqual(card.arts[0].specialValues, [50]);
  assert.equal(card.arts[0].effect, '自分の推しホロメンが〈白銀ノエル〉で、このホロメンの残りHPが200以上なら、このアーツ+200。');
});

test('hBP09-100 Gyudon heals a damaged hBP09-031 for 50 + 100 only once per turn on that copy', () => {
  let state = giftFixture({ centerDamage: 210 });
  state = useNoelGyudon(state, 'center');
  assert.equal(state.players[0].zones.center.damage, 60, 'the first Gyudon ability heals 150 HP');
  assert.ok(state.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 10));
  state = useNoelGyudon(state, 'center');
  assert.equal(state.players[0].zones.center.damage, 10, 'the second ability heals only its printed 50 HP this turn');
});

test('each separate hBP09-031 has its own once-per-turn Gift allowance', () => {
  let state = giftFixture();
  state = useNoelGyudon(state, 'center');
  state = useNoelGyudon(state, 'back1');
  assert.equal(state.players[0].zones.center.damage, 60);
  assert.equal(state.players[0].zones.back1.damage, 30);
});

test('the older named hBP05-075 牛丼 ability also grants the Noel Gift while preserving its baton modifier', () => {
  const state = giftFixture({ centerDamage: 210 });
  const bowl = instance('hBP05-075');
  state.players[0].hand.push(bowl);
  const result = act(state, { type: 'play', cardId: bowl.id });
  assert.equal(result.pendingChoice?.effect, 'healAndModifier');
  const healed = answer(result, { zone: 'center' });
  assert.equal(healed.players[0].zones.center.damage, 90, 'hBP05-075 restores 20 plus the Gift 100');
  assert.ok(healed.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'batonCost' && modifier.amount === -2));
});

test('hBP09-030 Archive-count recovery is not itself a 牛丼-card ability and does not consume the Gift', () => {
  let state = giftFixture({ centerDamage: 210 });
  state = useArchiveCountCollabOnNoel(state);
  assert.equal(state.players[0].zones.center.damage, 200, 'Noel Collab restores only its printed 10 HP');
  state = useNoelGyudon(state, 'center');
  assert.equal(state.players[0].zones.center.damage, 50, 'the subsequent 〈牛丼〉 Event still receives the unused +100');
});

test('the Noel Gift cannot heal through damage caps below zero', () => {
  let state = giftFixture({ centerDamage: 40 });
  state = useNoelGyudon(state, 'center');
  assert.equal(state.players[0].zones.center.damage, 0);
});

test('the hBP09-031 Arts +200 applies at exactly 200 remaining HP and stops at 199', () => {
  const exact = act(artsFixture({ sourceDamage: 20 }), { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  assert.equal(exact.players[1].zones.center.damage, 210, '10 base + 200 at 220 - 20 damage');
  const below = act(artsFixture({ sourceDamage: 21 }), { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  assert.equal(below.players[1].zones.center.damage, 10, '199 remaining HP does not meet the condition');
});

test('the Arts checks the Oshi card name, accepts older Noel Oshi and rejects a different Oshi', () => {
  const olderNoel = act(artsFixture({ oshi: 'hBP05-001' }), { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  assert.equal(olderNoel.players[1].zones.center.damage, 210);
  const otherOshi = act(artsFixture({ oshi: 'hBP09-006' }), { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  assert.equal(otherOshi.players[1].zones.center.damage, 10);
});

test('the Arts blue-target +50 stacks with the conditional +200 and resolves the knockout', () => {
  const result = act(artsFixture({ target: 'hBP05-050' }), { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  assert.ok(result.log.some(entry => JSON.stringify(entry).includes('造成 260 傷害')), '10 base + 200 condition + 50 Blue-target bonus');
  assert.equal(result.players[1].life.length, 3, 'the Blue Buzz target is downed and its printed -2 Life Extra resolves');
});

test('an unused Gift is available again on the Noel player’s next turn', () => {
  let state = useNoelGyudon(giftFixture({ centerDamage: 210 }), 'center');
  assert.equal(state.players[0].zones.center.damage, 60);
  state.turn += 1;
  state.activePlayer = 0;
  state.players[0].turnEvents.turn = state.turn;
  state = useNoelGyudon(state, 'center');
  assert.equal(state.players[0].zones.center.damage, 0, 'the next turn restores 50 + 100 HP, capped by actual damage');
});
