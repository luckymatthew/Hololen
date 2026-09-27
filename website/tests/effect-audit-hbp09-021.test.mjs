import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, settle, conserve } from './hbp09-fixtures.mjs';

function replaceStage(player, zones) {
  for (const old of Object.values(player.zones)) {
    if (old) player.archive.push(...old.stack, ...old.cheer, ...old.attachments);
  }
  player.zones = { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null, ...zones };
}

function energized(number, cheerCount = 0) {
  const stageUnit = unit(number);
  stageUnit.cheer = Array.from({ length: cheerCount }, () => instance('hY01-001'));
  return stageUnit;
}

function turnEvents(turn) {
  return { turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
}

function artsFixture({ source = 'hBP09-021', sourceZone = 'center', target = 'hBP09-018', targetZone = 'center', targetDamage = 0, batonTurn = 0, deckSize = 4 } = {}) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.firstPlayer = 1;
  state.phase = 'performance';
  const owner = state.players[0];
  const sourceUnit = energized(source, 2);
  if (sourceZone === 'collab') sourceUnit.collabbedTurn = state.turn;
  replaceStage(owner, { center: sourceZone === 'center' ? sourceUnit : energized('hBP01-017', 1), collab: sourceZone === 'collab' ? sourceUnit : null });
  owner.turnEvents = turnEvents(state.turn);
  owner.batonTurn = batonTurn;
  if (sourceZone === 'collab') owner.collabTurn = state.turn;
  owner.mainDeck = Array.from({ length: deckSize }, (_, index) => instance(index === 0 ? 'hBP09-050' : 'hBP09-051'));
  const rival = state.players[1];
  replaceStage(rival, { center: energized(target), back1: energized('hBP09-015') });
  rival.zones[targetZone].damage = targetDamage;
  rival.turnEvents = turnEvents(state.turn);
  return state;
}

function resolveArts(state, sourceZone = 'center', targetZone = 'center') {
  return settle(act(state, { type: 'attack', sourceZone, artIndex: 0, targetZone }));
}

test('hBP09-021 Arts is 80, gains 80 after any own current-turn Baton, and the Red +50 icon stays target-specific', () => {
  for (const [sourceZone, batonTurn, target, expected] of [
    ['center', 0, 'hBP09-018', 80],
    ['center', 7, 'hBP09-018', 80],
    ['center', 8, 'hBP09-018', 160],
    ['collab', 8, 'hBP09-018', 160],
    ['center', 8, 'hBP01-071', 210],
  ]) {
    const state = artsFixture({ sourceZone, batonTurn, target });
    const before = structuredClone(state);
    const result = resolveArts(state, sourceZone);
    if (expected === 160 && target === 'hBP09-018') assert.equal(result.players[1].zones.center, null, '160 damage downs the 160-HP White target');
    else assert.equal(result.players[1].zones.center.damage, expected, `${sourceZone}, Baton turn ${batonTurn}, target ${target}`);
    assert.deepEqual(result.players[0].zones[sourceZone].cheer.map(card => card.number), ['hY01-001', 'hY01-001'], 'Arts costs are paid without archiving attached Cheer');
    if (expected < 160) assert.deepEqual(result.players[0].holoPower.map(card => card.id), before.players[0].holoPower.map(card => card.id));
    conserve(before, result);
  }
});

test('hBP09-021 Gift moves exactly the next main-deck card to Holo Power when its Arts downs an opponent', () => {
  const state = artsFixture({ batonTurn: 8, deckSize: 3 });
  const before = structuredClone(state);
  const deckTop = state.players[0].mainDeck[0];
  const oldPower = state.players[0].holoPower.length;
  const result = resolveArts(state);
  assert.equal(result.players[1].zones.center, null, '160 damage downs the 160-HP target');
  assert.equal(result.players[0].holoPower.length, oldPower + 1);
  assert.equal(result.players[0].holoPower.at(-1).id, deckTop.id, 'the exact top card moves to Holo Power');
  assert.equal(result.players[0].mainDeck[0].id, before.players[0].mainDeck[1].id, 'only one top card is removed');
  assert.equal(result.knockouts.at(-1).cardNumber, 'hBP09-018');
  conserve(before, result);
});

test('hBP09-021 Gift does not trigger when its Arts does not down, when another top Holomem downs, or when its deck is empty', () => {
  const noDown = artsFixture({ batonTurn: 0, deckSize: 3 });
  const noDownPower = noDown.players[0].holoPower.length;
  const survivor = resolveArts(noDown);
  assert.equal(survivor.players[1].zones.center.damage, 80);
  assert.equal(survivor.players[0].holoPower.length, noDownPower);

  const otherTop = artsFixture({ source: 'hBP09-020', targetDamage: 100, deckSize: 3 });
  otherTop.players[0].zones.center.stack.unshift(instance('hBP09-021'));
  const otherTopPower = otherTop.players[0].holoPower.length;
  const otherTopResult = resolveArts(otherTop);
  assert.equal(otherTopResult.knockouts.at(-1).cardNumber, 'hBP09-018');
  assert.equal(otherTopResult.players[0].holoPower.length, otherTopPower, 'a covered hBP09-021 Gift is inactive');

  const emptyDeck = artsFixture({ batonTurn: 8, deckSize: 0 });
  const emptyPower = emptyDeck.players[0].holoPower.length;
  const emptyResult = resolveArts(emptyDeck);
  assert.equal(emptyResult.knockouts.at(-1).cardNumber, 'hBP09-018');
  assert.equal(emptyResult.players[0].holoPower.length, emptyPower, 'empty deck does not invent or duplicate a card');
});

test('hBP09-021 sees a real Baton earlier in the same turn, then resolves its Arts and Gift', () => {
  const state = artsFixture({ sourceZone: 'collab', batonTurn: 0, target: 'hBP09-018' });
  state.phase = 'main';
  state.players[0].zones.back1 = energized('hBP09-016');
  const baton = act(state, { type: 'baton', zone: 'back1' });
  assert.equal(baton.players[0].batonTurn, state.turn);
  assert.equal(baton.players[0].zones.collab.stack.at(-1).number, 'hBP09-021');
  const performance = act(baton, { type: 'advance' });
  assert.equal(performance.phase, 'performance');
  const before = structuredClone(performance);
  const top = performance.players[0].mainDeck[0];
  const result = resolveArts(performance, 'collab');
  assert.equal(result.players[1].zones.center, null, 'the actual same-turn Baton makes this Arts deal 160');
  assert.equal(result.players[0].holoPower.at(-1).id, top.id, 'the Gift resolves from the attacking Holomem');
  conserve(before, result);
});

test('website catalogue retains all official RR/SR/UR hBP09-021 printings and Japanese clauses', () => {
  const card = cards.find(entry => entry.number === 'hBP09-021');
  assert.ok(card);
  assert.deepEqual(new Set(card.variants.map(variant => variant.id)), new Set(['hbp09-hBP09-021_RR', 'hbp09-hBP09-021_SR', 'hbp09-hBP09-021_UR']));
  assert.equal(card.jpName, '轟はじめ');
  assert.equal(card.stage, '2nd');
  assert.equal(card.hp, 200);
  assert.equal(card.baton, 2);
  assert.equal(card.keyword.name, 'ストイックダンサー');
  assert.equal(card.keyword.effect, 'このホロメンが相手のホロメンをダウンさせた時、自分のデッキの上から1枚をホロパワーにする。');
  assert.equal(card.arts[0].name, '尽きることなき情熱');
  assert.deepEqual(card.arts[0].cost, ['白', '白']);
  assert.equal(card.arts[0].damage, 80);
  assert.deepEqual(card.arts[0].specialTargets, ['紅']);
  assert.deepEqual(card.arts[0].specialValues, [50]);
  assert.equal(card.arts[0].effect, 'このターンに自分のホロメンがバトンタッチしていたなら、このアーツ+80。');
});
