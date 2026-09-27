import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, answer, conserve } from './hbp09-fixtures.mjs';

const card049 = cards.find(card => card.number === 'hBP09-049');
const subaruOshis = ['hBP09-001', 'hBP04-006', 'hBD24-056', 'hSD19-001'];

function artState({ oshi = 'hBP09-001', target = 'hBP01-037', cheer = 0, archive = [] } = {}) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'performance';
  const player = state.players[0];
  player.oshi = instance(oshi);
  player.zones = { center: unit('hBP09-049', cheer), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  player.zones.center.enteredTurn = 1;
  player.zones.center.bloomedTurn = 0;
  player.turnsTaken = 3;
  player.archive = archive.map(instance);
  player.turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  player.namedUsageTurns = {};
  state.players[1].zones = { center: unit(target), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  state.players[1].turnsTaken = 3;
  return state;
}

function attack(state) {
  return act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
}

test('hBP09-049 R/SR identity and exact Gift/Arts text match the official card list', () => {
  assert.ok(card049);
  assert.equal(card049.jpName, 'ハコス・ベールズ');
  assert.equal(card049.stage, '2nd');
  assert.equal(card049.hp, 190);
  assert.deepEqual(card049.colors, ['紅']);
  assert.equal(card049.baton, 2);
  assert.deepEqual(new Set(card049.variants.map(variant => variant.rarity)), new Set(['R', 'SR']));
  assert.equal(card049.keyword.type, 'gift');
  assert.equal(card049.keyword.name, '熱き取り調べ');
  assert.equal(card049.keyword.effect, '自分の推しホロメンが〈大空スバル〉なら、このホロメンのアーツに必要な無色-3。');
  assert.deepEqual(card049.arts[0].cost, ['無色', '無色', '無色']);
  assert.equal(card049.arts[0].damage, 80);
  assert.deepEqual(card049.arts[0].specialTargets, ['綠']);
  assert.deepEqual(card049.arts[0].specialValues, [50]);
  assert.equal(card049.arts[0].effect, '自分の推しホロメンが〈大空スバル〉なら、自分のアーカイブの[〈大空スバル〉か〈ハコス・ベールズ〉]1枚を手札に戻す。');
});

test('Subaru Gift removes all three Colorless requirements for each official Subaru Oshi printing', () => {
  for (const oshi of subaruOshis) {
    const result = attack(artState({ oshi, target: 'hBP09-041' }));
    assert.equal(result.players[1].zones.center.damage, 80, `${oshi}: red target receives base Arts damage`);
    assert.equal(result.players[0].zones.center.rested, true, `${oshi}: zero-cost Arts can be used and rests Baelz`);
    assert.equal(result.players[0].zones.center.cheer.length, 0, `${oshi}: no Cheer is needed after -3`);
    assert.equal(result.pendingChoice, null);
  }
});

test('without Subaru Oshi the Arts still requires three Cheer, keeps them attached, and rejects two', () => {
  assert.throws(() => attack(artState({ oshi: 'hBP09-006', target: 'hBP09-041', cheer: 2 })), /應援不足|Arts/);
  const state = artState({ oshi: 'hBP09-006', target: 'hBP09-041', cheer: 3 });
  const cheerIds = state.players[0].zones.center.cheer.map(card => card.id);
  const result = attack(state);
  assert.equal(result.players[1].zones.center.damage, 80);
  assert.equal(result.players[0].zones.center.rested, true);
  assert.deepEqual(result.players[0].zones.center.cheer.map(card => card.id), cheerIds, 'Arts costs remain attached');
});

test('the Green special-attack icon adds 50 only against a Green target', () => {
  const green = attack(artState({ oshi: 'hBP09-006', target: 'hBP01-037', cheer: 3 }));
  const red = attack(artState({ oshi: 'hBP09-006', target: 'hBP09-041', cheer: 3 }));
  assert.equal(green.players[1].zones.center.damage, 130);
  assert.equal(red.players[1].zones.center.damage, 80);
});

test('Subaru Arts recovers exactly one eligible Subaru or Baelz from Archive', () => {
  const state = artState({ oshi: 'hBP04-006', target: 'hBP09-041', archive: ['hBP09-010', 'hBP09-048', 'hBP09-041'] });
  const before = structuredClone(state);
  let result = attack(state);
  assert.equal(result.pendingChoice?.type, 'cardSelection');
  assert.equal(result.pendingChoice.min, 1);
  assert.equal(result.pendingChoice.max, 1);
  assert.equal(result.pendingChoice.optional, false, 'the conditional recovery is mandatory when a matching card exists');
  assert.deepEqual(new Set(result.pendingChoice.cards.map(card => card.number)), new Set(['hBP09-010', 'hBP09-048']));
  const selected = result.pendingChoice.cards.find(card => card.number === 'hBP09-048');
  result = answer(result, { cardIds: [selected.id] });
  assert.ok(result.players[0].hand.some(card => card.id === selected.id));
  assert.ok(result.players[0].archive.some(card => card.number === 'hBP09-010'));
  assert.ok(result.players[0].archive.some(card => card.number === 'hBP09-041'), 'ineligible Archive cards remain');
  conserve(before, result);
});

test('non-Subaru Oshi gates recovery and an empty eligible Archive creates no impossible choice', () => {
  const archived = ['hBP09-010', 'hBP09-048'];
  const otherOshi = attack(artState({ oshi: 'hBP09-006', target: 'hBP09-041', cheer: 3, archive: archived }));
  assert.equal(otherOshi.pendingChoice, null);
  assert.deepEqual(otherOshi.players[0].archive.map(card => card.number), archived);

  const noMatch = attack(artState({ oshi: 'hBP09-001', target: 'hBP09-041' }));
  assert.equal(noMatch.pendingChoice, null);
  assert.equal(noMatch.players[1].zones.center.damage, 80);
});
