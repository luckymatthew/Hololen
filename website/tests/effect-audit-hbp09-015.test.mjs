import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, isActionCandidateLegal } from '../lib/simulator/engine.mjs';
import { fixture, cards, instance, unit, conserve } from './hbp09-fixtures.mjs';

function cleanStage(state, playerIndex, { center, back1, back2, collab = null }) {
  const player = state.players[playerIndex];
  for (const old of Object.values(player.zones)) if (old) player.archive.push(...old.stack, ...old.cheer, ...old.attachments);
  player.zones = { center: center || null, collab: collab || null, back1: back1 || null, back2: back2 || null, back3: null, back4: null, back5: null };
  return player;
}

function batonCostFixture({ center = 'hBP09-015', centerCheer = 0, hajimeZone = 'center', ownBacks = 2, opponentBacks = 0 } = {}) {
  const state = fixture();
  state.turn = 8; state.activePlayer = 0; state.phase = 'main';
  const actor = state.players[0];
  const own = {
    center: unit(center, centerCheer),
    back1: unit(hajimeZone === 'back1' ? 'hBP09-015' : 'hBP09-016'),
    back2: ownBacks >= 2 ? unit('hBP09-017') : null,
  };
  if (hajimeZone === 'center') own.center = unit('hBP09-015', centerCheer);
  if (hajimeZone === 'back2' && own.back2) own.back2 = unit('hBP09-015');
  cleanStage(state, 0, own);
  const rival = state.players[1];
  for (const old of Object.values(rival.zones)) if (old) rival.archive.push(...old.stack, ...old.cheer, ...old.attachments);
  rival.zones = { center: unit('hBP09-064'), collab: null, back1: opponentBacks >= 1 ? unit('hBP09-017') : null, back2: opponentBacks >= 2 ? unit('hBP09-017') : null, back3: opponentBacks >= 3 ? unit('hBP09-017') : null, back4: opponentBacks >= 4 ? unit('hBP09-017') : null, back5: null };
  actor.turnEvents = { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  return state;
}

function batonThenArtsFixture({ performBaton }) {
  const state = fixture();
  state.turn = 8; state.activePlayer = 0; state.phase = 'main';
  const ownCenter = unit('hBP09-064', 1);
  ownCenter.cheer[0] = instance('hY05-001');
  const hajime = unit('hBP09-015', 1);
  hajime.cheer[0] = instance('hY01-001');
  cleanStage(state, 0, { center: ownCenter, back1: hajime, back2: unit('hBP09-017') });
  state.players[1].zones.center = unit('hBP09-064');
  state.players[0].turnEvents = { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  let current = applyAction(state, 0, { type: 'collab', zone: 'back1' }, cards, () => 0.25);
  assert.equal(current.players[0].zones.collab.stack.at(-1).number, 'hBP09-015');
  if (performBaton) current = applyAction(current, 0, { type: 'baton', zone: 'back2' }, cards, () => 0.25);
  current.phase = 'performance';
  return current;
}

test('hBP09-015 Gift reduces only its own Baton cost to zero when its owner has at least three stage Holomem', () => {
  const state = batonCostFixture({ center: 'hBP09-015', ownBacks: 1, centerCheer: 0, opponentBacks: 5 });
  state.players[0].zones.collab = unit('hBP09-017');
  const action = { type: 'baton', zone: 'back1' };
  const before = structuredClone(state);
  assert.equal(isActionCandidateLegal(state, 0, action, cards), true, 'the third own stage Holomem makes the printed one-Cheer cost zero even with no Cheer attached');
  const result = applyAction(state, 0, action, cards, () => 0.25);
  assert.equal(result.players[0].zones.center.stack.at(-1).number, 'hBP09-016');
  assert.equal(result.players[0].zones.back1.stack.at(-1).number, 'hBP09-015');
  assert.equal(result.players[0].archive.filter(card => card.number.startsWith('hY')).length, 0, 'zero cost archives no Cheer');
  assert.equal(result.players[0].batonTurn, result.turn);
  conserve(before, result);
});

test('hBP09-015 Gift is inactive when it is underneath the current top Holomem card', () => {
  const state = batonCostFixture({ center: 'hBP09-015', ownBacks: 2, centerCheer: 0 });
  state.players[0].zones.center.stack.push(instance('hBP09-018'));
  const snapshot = JSON.stringify(state);
  const action = { type: 'baton', zone: 'back1' };
  assert.equal(isActionCandidateLegal(state, 0, action, cards), false, 'CR 10.3.4.1 limits a Holomem ability to the current top card');
  assert.throws(() => applyAction(state, 0, action, cards, () => 0.25), /應援不足/);
  assert.equal(JSON.stringify(state), snapshot);
});

test('hBP09-015 Gift does not reduce Baton cost with only two own stage Holomem, regardless of opponent stage size', () => {
  const state = batonCostFixture({ center: 'hBP09-015', ownBacks: 1, centerCheer: 0, opponentBacks: 5 });
  const snapshot = JSON.stringify(state);
  const action = { type: 'baton', zone: 'back1' };
  assert.equal(isActionCandidateLegal(state, 0, action, cards), false, 'the opponent’s five Holomem do not count toward this Gift');
  assert.throws(() => applyAction(state, 0, action, cards, () => 0.25), /應援不足/);
  assert.equal(JSON.stringify(state), snapshot, 'an illegal no-Cheer Baton leaves the original state untouched');
});

test('hBP09-015 Gift does not reduce another Holomem’s Baton cost', () => {
  const state = batonCostFixture({ center: 'hBP09-064', centerCheer: 0, hajimeZone: 'back1', ownBacks: 2 });
  const action = { type: 'baton', zone: 'back1' };
  assert.equal(isActionCandidateLegal(state, 0, action, cards), false, 'the Gift belongs only to the hBP09-015 Holomem, which is in Back');
  assert.throws(() => applyAction(state, 0, action, cards, () => 0.25), /應援不足/);
});

test('hBP09-015 Arts receives +20 after a different own Holomem actually Batons this turn', () => {
  const state = batonThenArtsFixture({ performBaton: true });
  const before = structuredClone(state);
  assert.equal(state.players[0].batonTurn, state.turn);
  const result = applyAction(state, 0, { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' }, cards, () => 0.25);
  assert.equal(result.players[1].zones.center.damage, 40, 'printed 20 plus the current-turn Baton bonus from another own Holomem');
  conserve(before, result);
});

test('hBP09-015 Arts gets no +20 before Baton or from a previous turn’s Baton', () => {
  for (const batonTurn of [0, 7]) {
    const state = batonThenArtsFixture({ performBaton: false });
    state.players[0].batonTurn = batonTurn;
    const result = applyAction(state, 0, { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' }, cards, () => 0.25);
    assert.equal(result.players[1].zones.center.damage, 20, `batonTurn=${batonTurn} must not grant the current-turn bonus`);
  }
});

test('website catalog matches the official hBP09-015 Gift and Arts Japanese text and values', () => {
  const card = cards.find(entry => entry.number === 'hBP09-015');
  assert.ok(card);
  assert.deepEqual(new Set(card.variants.map(variant => variant.id)), new Set(['hbp09-hBP09-015_C', 'hbp09-hBP09-015_S']));
  assert.equal(card.keyword.effect, '自分のステージにホロメンが3人以上いるなら、このホロメンのバトンタッチに必要な無色-1。');
  assert.equal(card.arts[0].effect, 'このターンに自分のホロメンがバトンタッチしていたなら、このアーツ+20。');
});
