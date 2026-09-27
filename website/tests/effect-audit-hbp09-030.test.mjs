import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act } from './hbp09-fixtures.mjs';
import { runAiStep } from '../lib/simulator/ai.mjs';

const green = count => Array.from({ length: count }, () => instance('hY02-013'));

function moveArchivedGyudon(player, count) {
  for (let index = 0; index < count; index += 1) {
    const card = player.mainDeck.pop();
    assert.ok(card, 'fixture must have source cards to move into Archive');
    card.number = 'hBP09-100';
    player.archive.push(card);
  }
}

function collabFixture(gyudonCount, damages = { center: 20, back2: 20 }) {
  const state = fixture();
  state.phase = 'main';
  state.turn = 8;
  state.players[0].turnsTaken = 3;
  state.players[0].turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  state.players[0].zones = { center: unit('hBP09-064'), collab: null, back1: unit('hBP09-030'), back2: unit('hBP09-064'), back3: null, back4: null, back5: null };
  state.players[0].zones.center.damage = damages.center || 0;
  state.players[0].zones.back2.damage = damages.back2 || 0;
  moveArchivedGyudon(state.players[0], gyudonCount);
  return state;
}

function artsFixture(targetNumber, gyudonCount) {
  const state = fixture();
  state.phase = 'performance';
  state.turn = 8;
  state.players[0].turnsTaken = 3;
  state.players[0].turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  state.players[0].zones = { center: unit('hBP09-030', 2), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  state.players[0].zones.center.cheer = green(2);
  const opponent = state.players[1];
  opponent.zones = { center: unit(targetNumber), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  moveArchivedGyudon(state.players[0], gyudonCount);
  return state;
}

test('hBP09-030 U/S identity and both Japanese ability texts match the official catalog snapshot', () => {
  const card = cards.find(entry => entry.number === 'hBP09-030');
  assert.ok(card);
  assert.equal(card.jpName, '白銀ノエル');
  assert.equal(card.stage, '2nd');
  assert.equal(card.hp, 220);
  assert.deepEqual(new Set(card.variants.map(variant => variant.rarity)), new Set(['U', 'S']));
  assert.equal(card.keyword.type, 'collab');
  assert.equal(card.keyword.effect, '自分のアーカイブの〈牛丼〉1枚につき、自分のホロメン1人のHP10回復。');
  assert.equal(card.arts[0].name, '頼もしき筋力');
  assert.equal(card.arts[0].damage, 100);
  assert.deepEqual(card.arts[0].cost, ['綠', '無色']);
  assert.deepEqual(card.arts[0].specialTargets, ['黃']);
  assert.deepEqual(card.arts[0].specialValues, [50]);
  assert.equal(card.arts[0].effect, '自分のアーカイブの〈牛丼〉1枚につき、このアーツ+10。');
});

test('hBP09-030 Collab turns each archived Gyudon into one distributable 10-HP heal', () => {
  let result = act(collabFixture(2), { type: 'collab', zone: 'back1' });
  if (result.pendingChoice?.type === 'stageTarget') result = act(result, { type: 'choose', zone: 'center' }, result.pendingChoice.playerIndex);
  assert.equal(result.pendingChoice?.type, 'healDistribution');
  assert.equal(result.pendingChoice.count, 2);
  assert.equal(result.pendingChoice.unitAmount, 10);
  assert.ok(result.pendingChoice.options.includes('center'));
  assert.ok(result.pendingChoice.options.includes('back2'));
  const healed = act(result, { type: 'choose', allocations: { center: 1, back2: 1 } }, result.pendingChoice.playerIndex);
  assert.equal(healed.players[0].zones.center.damage, 10);
  assert.equal(healed.players[0].zones.back2.damage, 10);
  assert.equal(healed.players[0].zones.collab.damage, 0);
});

test('hBP09-030 may target a full Holomem because its printed effect has no damaged-target restriction', () => {
  const state = collabFixture(2, { center: 20, back2: 0 });
  const pending = act(state, { type: 'collab', zone: 'back1' });
  assert.equal(pending.pendingChoice?.type, 'healDistribution');
  assert.ok(pending.pendingChoice.options.includes('back2'));
  const healed = act(pending, { type: 'choose', allocations: { center: 1, back2: 1 } }, pending.pendingChoice.playerIndex);
  assert.equal(healed.players[0].zones.center.damage, 10);
  assert.equal(healed.players[0].zones.back2.damage, 0, 'HP recovery on a full unit is capped at zero damage');
});

test('hBP09-030 heal distribution must account for every archived Gyudon, even when one target has little HP missing', () => {
  let result = act(collabFixture(3, { center: 5, back2: 20 }), { type: 'collab', zone: 'back1' });
  if (result.pendingChoice?.type === 'stageTarget') result = act(result, { type: 'choose', zone: 'center' }, result.pendingChoice.playerIndex);
  assert.equal(result.pendingChoice?.type, 'healDistribution');
  assert.equal(result.pendingChoice.count, 3);
  let healed = act(result, { type: 'choose', allocations: { center: 1, back2: 2 } }, result.pendingChoice.playerIndex);
  assert.equal(healed.players[0].zones.center.damage, 0, 'a 10-HP heal is capped by the five damage actually present');
  assert.equal(healed.players[0].zones.back2.damage, 0);
});

test('hBP09-030 does not create a zero-count heal choice when Archive has no Gyudon', () => {
  const result = act(collabFixture(0), { type: 'collab', zone: 'back1' });
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].zones.center.damage, 20);
  assert.equal(result.players[0].zones.back2.damage, 20);
});

test('offline AI completes hBP09-030 per-Gyudon heal allocation through the choice pipeline', () => {
  const before = collabFixture(2);
  const pending = act(before, { type: 'collab', zone: 'back1' });
  assert.equal(pending.pendingChoice?.type, 'healDistribution');
  const result = runAiStep(pending, cards, 0, () => 0.4);
  assert.equal(result.aiLastStepCount, 1);
  assert.equal(result.pendingChoice, null);
  const remainingDamage = result.players[0].zones.center.damage + result.players[0].zones.back2.damage;
  assert.equal(remainingDamage, 20, 'AI uses both 10-HP allocations on damaged Holomen');
});

test('hBP09-030 Arts adds 10 per archived Gyudon and its Yellow-target +50', () => {
  const state = artsFixture('hBP03-066', 2);
  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  assert.equal(result.players[1].zones.center.damage, 170, '100 base + 2 Gyudon × 10 + Yellow target 50');
});

test('hBP09-030 Arts counts an event treated as Gyudon but ignores other archived events', () => {
  const state = artsFixture('hBP03-066', 1);
  const otherEvent = state.players[0].mainDeck.pop();
  otherEvent.number = 'hBP09-104';
  state.players[0].archive.push(otherEvent);
  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  assert.equal(result.players[1].zones.center.damage, 160, '100 base + one Gyudon-tagged Event 10 + Yellow target 50');
});
