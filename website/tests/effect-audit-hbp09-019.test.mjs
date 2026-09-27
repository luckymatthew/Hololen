import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, conserve } from './hbp09-fixtures.mjs';

function replaceStage(player, zones) {
  for (const old of Object.values(player.zones)) {
    if (old) player.archive.push(...old.stack, ...old.cheer, ...old.attachments);
  }
  player.zones = { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null, ...zones };
}

function layeredUnit(numbers, cheer = []) {
  const top = unit(numbers.at(-1));
  top.stack = numbers.map(number => instance(number));
  top.cheer = cheer.map(number => instance(number));
  return top;
}

function bloomFixture() {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'main';
  const player = state.players[0];
  player.turnsTaken = 3;
  replaceStage(player, {
    // Legal 1st -> 2nd Hajime stack with only one attached Cheer. The
    // 2-Cheer printed Baton cost can succeed only after the -2 effect.
    center: layeredUnit(['hBP09-018', 'hBP09-020'], ['hY01-001']),
    back1: unit('hBP09-015'),
    back2: unit('hBP09-016'),
  });
  for (const stageUnit of Object.values(player.zones)) {
    if (stageUnit) {
      stageUnit.enteredTurn = 1;
      stageUnit.bloomedTurn = 0;
      stageUnit.rested = false;
    }
  }
  const bloom = instance('hBP09-019');
  player.hand.push(bloom);
  player.turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  player.namedUsageTurns = {};
  return { state, bloom };
}

function resolveBackBloom(state, card, targetZone) {
  let next = act(state, { type: 'play', cardId: card.id });
  assert.equal(next.pendingChoice?.type, 'bloom');
  assert.ok(next.pendingChoice.options.includes('back1'));
  next = JSON.parse(JSON.stringify(next)); // resume the actual pending Bloom choice after an offline save
  next = act(next, { type: 'choose', zone: 'back1' });
  assert.equal(next.pendingChoice?.type, 'stageTarget');
  assert.equal(next.pendingChoice.playerIndex, 0, 'the target choice belongs to the Bloom controller');
  assert.ok(next.pendingChoice.options.includes(targetZone));
  assert.deepEqual(new Set(next.pendingChoice.options), new Set(['center', 'back1', 'back2']));
  return act(next, { type: 'choose', zone: targetZone });
}

function artsFixture(sourceZone, batonTurn) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'performance';
  const player = state.players[0];
  replaceStage(player, {
    center: sourceZone === 'center'
      ? layeredUnit(['hBP09-015', 'hBP09-019'], ['hY01-001'])
      : unit('hBP09-064'),
    ...(sourceZone === 'collab' ? { collab: layeredUnit(['hBP09-019'], ['hY01-001']) } : {}),
    ...(sourceZone === 'center' ? { back1: unit('hBP09-016') } : {}),
  });
  player.turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  player.batonTurn = batonTurn;
  if (sourceZone === 'collab') {
    player.zones.collab.collabbedTurn = state.turn;
    player.collabTurn = state.turn;
  }
  return state;
}

test('hBP09-019 Back Bloom selects any one of its controller’s Stage Holomen and reduces only that target by two Colorless', () => {
  for (const targetZone of ['center', 'back1', 'back2']) {
    const { state, bloom } = bloomFixture();
    const before = structuredClone(state);
    const result = resolveBackBloom(state, bloom, targetZone);
    const target = result.players[0].zones[targetZone];
    assert.ok(target.modifiers.some(modifier => modifier.kind === 'batonCost' && modifier.amount === -2 && modifier.expiresTurn === state.turn));
    assert.equal(result.players[1].zones.center.modifiers.length, 0, 'an opponent Stage unit is not a candidate');
    assert.equal(result.players[0].turnEvents.bloomCount, 1);
    conserve(before, result);
  }
});

test('hBP09-019 -2 Baton modifier floors the cost at zero and permits the reduced Center to Baton with one Cheer', () => {
  const { state, bloom } = bloomFixture();
  const cheer = state.players[0].zones.center.cheer[0];
  const result = resolveBackBloom(state, bloom, 'center');
  assert.equal(result.players[0].zones.center.stack.at(-1).number, 'hBP09-020');
  const afterBaton = act(result, { type: 'baton', zone: 'back1' });
  assert.equal(afterBaton.players[0].zones.back1.stack.at(-1).number, 'hBP09-020');
  assert.equal(afterBaton.players[0].zones.back1.cheer[0].id, cheer.id, 'the zero effective cost archives no Cheer');
  assert.ok(!afterBaton.players[0].archive.some(card => card.id === cheer.id));
  assert.equal(afterBaton.players[0].batonTurn, state.turn);
});

test('hBP09-019 modifier expires at the end of its turn', () => {
  const { state, bloom } = bloomFixture();
  const result = resolveBackBloom(state, bloom, 'center');
  const center = result.players[0].zones.center;
  assert.equal(center.modifiers.find(modifier => modifier.kind === 'batonCost')?.expiresTurn, state.turn);
  // Isolate the rule engine's turn boundary: an active modifier marked through
  // the previous turn must not make a 2-Cheer Baton payable from one Cheer.
  result.turn += 1;
  result.players[0].batonTurn = 0;
  result.players[0].zones.back1.rested = false;
  const snapshot = JSON.stringify(result);
  assert.throws(() => act(result, { type: 'baton', zone: 'back1' }), /應援不足/);
  assert.equal(JSON.stringify(result), snapshot, 'an expired modifier cannot alter a rejected Baton');
});

test('hBP09-019 Center Arts is 60 only after any own Holomen Batons this turn; Collab and no-Baton remain 40', () => {
  for (const [sourceZone, batonTurn, expected] of [
    ['center', 8, 60],
    ['center', 7, 40],
    ['collab', 8, 40],
  ]) {
    const state = artsFixture(sourceZone, batonTurn);
    const before = structuredClone(state);
    const result = act(state, { type: 'attack', sourceZone, artIndex: 0, targetZone: 'center' });
    assert.equal(result.players[1].zones.center.damage, expected, `${sourceZone}, batonTurn=${batonTurn}`);
    assert.equal(result.players[0].turnEvents.arts.at(-1), 'hBP09-019');
    conserve(before, result);
  }
});

test('hBP09-019 cannot use its Center-only Arts from Back and rejection is mutation-free', () => {
  const state = fixture();
  state.turn = 8;
  state.phase = 'performance';
  state.activePlayer = 0;
  const player = state.players[0];
  replaceStage(player, { center: unit('hBP09-064'), back1: layeredUnit(['hBP09-019'], ['hY01-001']) });
  const snapshot = JSON.stringify(state);
  assert.throws(() => act(state, { type: 'attack', sourceZone: 'back1', artIndex: 0, targetZone: 'center' }));
  assert.equal(JSON.stringify(state), snapshot);
});

test('website catalog matches the official hBP09-019 card number, R/SR variants and Japanese text', () => {
  const card = cards.find(entry => entry.number === 'hBP09-019');
  assert.ok(card);
  assert.deepEqual(new Set(card.variants.map(variant => variant.id)), new Set(['hbp09-hBP09-019_R', 'hbp09-hBP09-019_SR']));
  assert.equal(card.jpName, '轟はじめ');
  assert.equal(card.stage, '1st');
  assert.equal(card.baton, 1);
  assert.equal(card.keyword.name, 'はじめの愛チャ');
  assert.equal(card.keyword.effect, '[バックポジション限定]自分のステージのホロメン1人を選ぶ。このターンの間、選んだホロメンのバトンタッチに必要な無色-2。');
  assert.equal(card.arts[0].name, 'ぶんぶんばんちょー');
  assert.equal(card.arts[0].damage, 40);
  assert.deepEqual(card.arts[0].cost, ['白']);
  assert.equal(card.arts[0].effect, '[センターポジション限定]このターンに自分のホロメンがバトンタッチしていたなら、このアーツ+20。');
});
