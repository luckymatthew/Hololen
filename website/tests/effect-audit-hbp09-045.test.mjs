import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, conserve } from './hbp09-fixtures.mjs';

const card045 = cards.find(card => card.number === 'hBP09-045');

function replaceStage(player, zones) {
  for (const old of Object.values(player.zones)) {
    if (old) player.archive.push(...old.stack, ...old.cheer, ...old.attachments);
  }
  player.zones = { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null, ...zones };
}

function bloomFixture() {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'main';
  const player = state.players[0];
  replaceStage(player, { center: unit('hBP07-038') });
  player.zones.center.enteredTurn = 1;
  player.zones.center.bloomedTurn = 0;
  player.archive.push(...player.hand);
  player.hand = [instance('hBP09-045')];
  player.turnsTaken = 3;
  player.turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  player.namedUsageTurns = {};
  player.mainDeck = [instance('hBP09-046'), instance('hBP09-047'), instance('hBP09-048')];
  replaceStage(state.players[1], { center: unit('hBP09-041'), collab: unit('hBP09-042'), back1: unit('hBP09-043') });
  return state;
}

function resolveBloomDie(state, random) {
  const bloom = state.players[0].hand.find(card => card.number === 'hBP09-045');
  assert.ok(bloom);
  let result = act(state, { type: 'play', cardId: bloom.id }, 0, cards, random);
  assert.equal(result.pendingChoice?.type, 'bloom');
  result = act(result, { type: 'choose', zone: 'center' }, result.pendingChoice.playerIndex, cards, random);
  return result;
}

function artsFixture({ target = 'hBP03-035', archive = ['hBP03-031'] } = {}) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'performance';
  replaceStage(state.players[0], { center: unit('hBP09-045') });
  state.players[0].zones.center.cheer = ['hY03-001', 'hY03-002', 'hY03-017'].map(instance);
  state.players[0].archive = archive.map(instance);
  replaceStage(state.players[1], { center: unit(target) });
  return state;
}

test('hBP09-045 R/S printings and Japanese identity, Bloom Effect, Arts cost, damage and archive clause match the official catalog snapshot', () => {
  assert.ok(card045);
  assert.equal(card045.jpName, '赤井はあと');
  assert.equal(card045.stage, '2nd');
  assert.equal(card045.hp, 200);
  assert.deepEqual(new Set(card045.variants.map(variant => variant.rarity)), new Set(['R', 'SR']));
  assert.equal(card045.keyword.type, 'bloom');
  assert.equal(card045.keyword.effect, 'サイコロを1回振る。奇数なら、相手のセンターホロメンに特殊ダメージ30を与える。偶数なら、自分のデッキを2枚引く。');
  assert.equal(card045.arts[0].name, 'おいしいお菓子を作る！');
  assert.deepEqual(card045.arts[0].cost, ['紅', '紅', '無色']);
  assert.equal(card045.arts[0].damage, 170);
  assert.deepEqual(card045.arts[0].specialTargets, ['黃']);
  assert.deepEqual(card045.arts[0].specialValues, [50]);
  assert.equal(card045.arts[0].effect, '自分のアーカイブのDebut〈赤井はあと〉1枚をステージに出す。');
});

test('Sweet Haachama odd die deals exactly 30 Special damage to opposing Center and no other position', () => {
  const state = bloomFixture();
  const before = structuredClone(state);
  const result = resolveBloomDie(state, () => 0); // die 1
  assert.equal(result.players[1].zones.center.damage, 30);
  assert.equal(result.players[1].zones.collab.damage, 0);
  assert.equal(result.players[1].zones.back1.damage, 0);
  assert.deepEqual(result.players[0].hand.map(card => card.number), []);
  assert.equal(result.players[0].mainDeck.length, before.players[0].mainDeck.length);
  assert.equal(result.players[0].turnEvents.dice.at(-1).value, 1);
  conserve(before, result);
});

test('Sweet Haachama even die draws the top two deck instances and causes no damage', () => {
  const state = bloomFixture();
  const before = structuredClone(state);
  const expectedDraw = before.players[0].mainDeck.slice(0, 2).map(card => card.id);
  const result = resolveBloomDie(state, () => 0.2); // die 2
  assert.deepEqual(result.players[0].hand.map(card => card.id), expectedDraw);
  assert.deepEqual(result.players[0].mainDeck.map(card => card.id), before.players[0].mainDeck.slice(2).map(card => card.id));
  assert.equal(result.players[1].zones.center.damage, 0);
  assert.equal(result.players[1].zones.collab.damage, 0);
  assert.equal(result.players[1].zones.back1.damage, 0);
  assert.equal(result.players[0].turnEvents.dice.at(-1).value, 2);
  conserve(before, result);
});

test('Oishii Okashi Arts applies 170 base plus Yellow +50 while retaining its paid Cheer', () => {
  for (const [target, expected] of [['hBP03-035', 170], ['hBP05-072', 220]]) {
    const state = artsFixture({ target });
    const before = structuredClone(state);
    const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, cards);
    assert.equal(result.pendingChoice?.type, 'cardSelection');
    assert.equal(result.pendingChoice.min, 1, 'the printed one-card instruction is mandatory when an eligible archive card exists');
    assert.equal(result.pendingChoice.max, 1);
    assert.equal(result.pendingChoice.optional, false);
    const pendingSnapshot = structuredClone(result);
    assert.throws(() => act(result, { type: 'choose', cardIds: [] }, 0, cards), /Wrong selection count/);
    assert.deepEqual(result, pendingSnapshot, 'an invalid decline leaves the legal pending effect intact');
    let settled = act(result, { type: 'choose', cardIds: [result.pendingChoice.selectableIds[0]] }, 0, cards);
    assert.equal(settled.pendingChoice?.type, 'stageTarget');
    assert.equal(settled.pendingChoice.optional, false);
    settled = act(settled, { type: 'choose', zone: 'back1' }, 0, cards);
    assert.equal(settled.players[0].zones.back1.stack.at(-1).number, 'hBP03-031');
    assert.equal(settled.players[0].archive.some(card => card.number === 'hBP03-031'), false);
    assert.equal(settled.players[1].zones.center.damage, expected, `${target} damage`);
    assert.equal(settled.players[0].zones.center.rested, true);
    assert.deepEqual(settled.players[0].zones.center.cheer.map(card => card.number), ['hY03-001', 'hY03-002', 'hY03-017']);
    conserve(before, settled);
  }
});

test('Oishii Okashi Arts does not prompt when the archive has no eligible Debut Haato', () => {
  const state = artsFixture({ archive: ['hBP03-032'] });
  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, cards);
  assert.equal(result.players[1].zones.center.damage, 170);
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].zones.back1, null);
});
