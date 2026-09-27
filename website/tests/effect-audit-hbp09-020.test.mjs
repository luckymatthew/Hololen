import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, settle, conserve } from './hbp09-fixtures.mjs';

function replaceStage(player, zones) {
  for (const old of Object.values(player.zones)) {
    if (old) player.archive.push(...old.stack, ...old.cheer, ...old.attachments);
  }
  player.zones = { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null, ...zones };
}

function turnEvents(turn) {
  return { turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
}

function artsFixture(opponentCenter = 'hBP02-042') {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'performance';
  const player = state.players[0];
  const center = unit('hBP01-017'); // Its second Arts costs White + Colorless.
  center.cheer = [instance('hY01-001')];
  const collab = unit('hBP09-020');
  collab.cheer = [instance('hY01-001')];
  collab.collabbedTurn = state.turn;
  replaceStage(player, { center, collab });
  player.collabTurn = state.turn;
  player.turnEvents = turnEvents(state.turn);
  const opponent = state.players[1];
  replaceStage(opponent, { center: unit(opponentCenter), back1: unit('hBP01-015') });
  opponent.cheerDeck.push(...opponent.life);
  opponent.life = opponent.cheerDeck.splice(0, 5);
  opponent.turnEvents = turnEvents(state.turn);
  return state;
}

function resetFixture(collabNumber) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 1;
  state.phase = 'performance';
  const owner = state.players[0];
  owner.turnsTaken = 2;
  const collab = unit(collabNumber);
  collab.rested = true;
  collab.cheer = [instance('hY01-001')];
  replaceStage(owner, { center: unit('hBP09-018'), collab });
  owner.collabTurn = 7;
  owner.turnEvents = turnEvents(state.turn);
  state.players[1].turnsTaken = 2;
  state.players[1].turnEvents = turnEvents(state.turn);
  return state;
}

test('hBP09-020 Gift keeps the returned Collab active in Reset Step; the vanilla control rests', () => {
  for (const [number, expectedRested] of [['hBP09-020', false], ['hBP09-018', true]]) {
    const state = resetFixture(number);
    const before = structuredClone(state);
    const result = act(state, { type: 'advance' }, 1);
    const owner = result.players[0];
    assert.equal(owner.zones.collab, null, number + ' leaves Collab at Reset Step');
    assert.equal(owner.zones.back1.stack.at(-1).number, number);
    assert.equal(owner.zones.back1.rested, expectedRested, number + ' Reset Step state');
    assert.deepEqual(owner.zones.back1.cheer.map(card => card.id), before.players[0].zones.collab.cheer.map(card => card.id));
    conserve(before, result);
  }
});

test('hBP09-020 Arts adds its Purple +50 icon to Arts damage, only for a Purple target', () => {
  for (const [target, expected] of [['hBP02-042', 110], ['hBP02-014', 60]]) {
    const state = artsFixture(target);
    const before = structuredClone(state);
    const sourceCheer = state.players[0].zones.collab.cheer[0].id;
    const centerCheer = state.players[0].zones.center.cheer[0].id;
    const result = act(state, { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' });
    assert.equal(result.players[1].zones.center.damage, expected, target);
    assert.equal(result.players[0].zones.collab.cheer[0].id, sourceCheer, 'Arts cost Cheer remains attached after payment');
    assert.equal(result.players[0].zones.center.cheer[0].id, centerCheer, 'unspent Center Cheer stays attached');
    assert.equal(result.players[0].zones.center.modifiers.find(item => item.kind === 'artCost:white')?.amount, -1);
    assert.equal(result.players[0].zones.center.modifiers.find(item => item.kind === 'artCost:white')?.expiresTurn, state.turn);
    conserve(before, result);
  }
});

test('hBP09-020 Collab ability reduces only the Center White symbol, keeps the Colorless requirement, then expires at the real turn boundary', () => {
  let state = artsFixture('hBP01-015');
  const initialCenterCheer = state.players[0].zones.center.cheer[0].id;
  state = act(state, { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' });
  const reduction = state.players[0].zones.center.modifiers.find(item => item.kind === 'artCost:white');
  assert.deepEqual(state.players[0].zones.center.cheer.map(card => card.id), [initialCenterCheer]);
  assert.equal(reduction.amount, -1);
  assert.equal(reduction.expiresTurn, 8);

  // One White Cheer now pays the remaining Colorless symbol of hBP01-017's
  // second Arts. Comprehensive Rules 12.3.3.1.1 says Arts do not archive cost.
  state = act(state, { type: 'attack', sourceZone: 'center', artIndex: 1, targetZone: 'center' });
  assert.deepEqual(state.players[0].zones.center.cheer.map(card => card.id), [initialCenterCheer]);
  assert.equal(state.players[0].turnEvents.arts.filter(number => number === 'hBP01-017').length, 1);
  state = settle(state);
  // Resolve both real turn boundaries; the next own turn must require both
  // printed symbols again, and the unchanged single Cheer is insufficient.
  state = settle(act(state, { type: 'advance' }, 0));
  state = settle(act(state, { type: 'advance' }, 1));
  state = act(state, { type: 'advance' }, 1);
  assert.equal(state.activePlayer, 0);
  assert.equal(state.pendingChoice?.type, 'cheerTarget');
  assert.ok(state.pendingChoice.options.includes('back1'));
  // Put the new turn's automatic Cheer on the returned 020, so the Center
  // retains exactly one Cheer and cannot pay the original two-symbol cost.
  state = act(state, { type: 'choose', zone: 'back1' }, 0);
  state = act(state, { type: 'advance' }, 0);
  assert.equal(state.activePlayer, 0);
  assert.equal(state.phase, 'performance');
  assert.ok(state.turn > reduction.expiresTurn);
  const snapshot = JSON.stringify(state);
  assert.throws(() => act(state, { type: 'attack', sourceZone: 'center', artIndex: 1, targetZone: 'center' }, 0), /應援不足/);
  assert.equal(JSON.stringify(state), snapshot, 'expired discount rejection must not mutate the match');
});

test('hBP09-020 Arts text, U/S identity, printed symbols, and color are retained in the catalogue', () => {
  const card = cards.find(entry => entry.number === 'hBP09-020');
  assert.ok(card);
  assert.deepEqual(new Set(card.variants.map(variant => variant.id)), new Set(['hbp09-hBP09-020_U', 'hbp09-hBP09-020_S']));
  assert.equal(card.jpName, '轟はじめ');
  assert.equal(card.stage, '2nd');
  assert.deepEqual(card.colors, ['白']);
  assert.equal(card.hp, 190);
  assert.deepEqual(card.arts[0].cost, ['白']);
  assert.equal(card.arts[0].damage, 60);
  assert.deepEqual(card.arts[0].specialTargets, ['紫']);
  assert.deepEqual(card.arts[0].specialValues, [50]);
  assert.equal(card.keyword.name, '奇想天外な盤面');
  assert.equal(card.keyword.effect, 'このホロメンはリセットステップでお休みしない。');
  assert.equal(card.arts[0].effect, '[コラボポジション限定]このターンの間、自分のセンターホロメンのアーツに必要な白-1。');

  const mumei = cards.find(entry => entry.number === 'hBP01-017');
  assert.ok(mumei);
  assert.deepEqual(mumei.arts[1].cost, ['白', '無色']);
  assert.equal(mumei.arts[1].damage, 60);
  assert.deepEqual(cards.find(entry => entry.number === 'hBP02-042').colors, ['紫']);
  assert.deepEqual(cards.find(entry => entry.number === 'hBP02-014').colors, ['白']);
});

test('hBP09-020 Colorless cost is still required and a Center-source Arts cannot grant its Collab-only effect', () => {
  const state = artsFixture('hBP01-015');
  state.players[0].zones.center.cheer = [];
  state.players[0].zones.collab.cheer = [];
  const noCheer = structuredClone(state);
  assert.throws(() => act(state, { type: 'attack', sourceZone: 'center', artIndex: 1, targetZone: 'center' }), /應援不足/);
  assert.equal(JSON.stringify(state), JSON.stringify(noCheer));

  const fromCenter = fixture();
  fromCenter.turn = 8;
  fromCenter.phase = 'performance';
  replaceStage(fromCenter.players[0], {
    center: unit('hBP09-020', 1),
    collab: unit('hBP09-018'),
  });
  fromCenter.players[0].zones.collab.cheer = [instance('hY01-001')];
  fromCenter.players[1].zones.center = unit('hBP01-015');
  const result = act(fromCenter, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  assert.equal(result.players[0].zones.center.modifiers.some(item => item.kind === 'artCost:white'), false);
});
