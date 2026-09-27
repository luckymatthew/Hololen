import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { pool, state, inst } from './fixtures/simulator-audit.mjs';

function playShyStream(knockouts, ownLives = 3, opponentLives = 5) {
  const game = state();
  game.phase = 'main';
  game.turn = 8;
  game.players[0].turnsTaken = 3;
  game.players[0].life = game.players[0].life.slice(0, ownLives);
  game.players[1].life = game.players[1].life.slice(0, opponentLives);
  game.players[0].hand = [inst('hBP05-079', 'shy-stream')];
  game.players[0].archive = [inst('hY01-001', 'archived-cheer')];
  game.knockouts = knockouts;
  return applyAction(game, 0, { type: 'play', cardId: 'shy-stream' }, pool, () => 0);
}

function stateWithOwnEffectKnockout() {
  const game = state();
  game.phase = 'main';
  game.turn = 8;
  game.players[0].turnsTaken = 3;
  game.players[0].life = game.players[0].life.slice(0, 3);
  game.players[1].life = game.players[1].life.slice(0, 5);
  game.knockouts = [
    { turn: 7, ownerIndex: 0, sourcePlayerIndex: 0, card: { number: 'hBP01-001', name: 'Previously Down Holomen' } },
  ];
  return game;
}

test('hBP05-079 counts an own Holomen KO during the prior opponent turn regardless of the KO effect owner', () => {
  const stateWithSelfCausedKnockout = playShyStream([
    { turn: 7, ownerIndex: 0, sourcePlayerIndex: 0, card: { number: 'hBP01-001' } },
  ]);

  assert.equal(stateWithSelfCausedKnockout.pendingChoice?.type, 'cardSelection');
  assert.equal(stateWithSelfCausedKnockout.pendingChoice?.effect, 'archiveCheerToStage');
  assert.deepEqual(stateWithSelfCausedKnockout.pendingChoice?.selectableIds, ['archived-cheer']);
});

test('hBP05-079 still requires a KO in the immediately prior opponent turn and fewer Life', () => {
  for (const knockouts of [
    [{ turn: 6, ownerIndex: 0, sourcePlayerIndex: 0 }],
    [{ turn: 7, ownerIndex: 1, sourcePlayerIndex: 0 }],
    [],
  ]) {
    assert.equal(playShyStream(knockouts).pendingChoice, null);
  }

  assert.equal(playShyStream([
    { turn: 7, ownerIndex: 0, sourcePlayerIndex: 0 },
  ], 5, 5).pendingChoice, null);
});

test('hBP06-088 accepts an own KO from an own effect during the prior opponent turn', () => {
  const game = stateWithOwnEffectKnockout();
  game.players[0].hand = [inst('hBP06-088', 'surprise-rabbit')];

  const result = applyAction(game, 0, { type: 'play', cardId: 'surprise-rabbit' }, pool, () => 0);
  assert.equal(result.pendingChoice?.type, 'stageTarget');
  assert.equal(result.pendingChoice?.effect, 'restMoveBack');
  assert.equal(result.pendingChoice?.targetPlayerIndex, 1);
});

test('hBP07-099 sees an own KO from an own effect during the prior opponent turn', () => {
  const game = stateWithOwnEffectKnockout();
  game.players[0].hand = [inst('hBP07-099', 'puhihi')];

  const result = applyAction(game, 0, { type: 'play', cardId: 'puhihi' }, pool, () => 0);
  assert.equal(result.pendingChoice?.type, 'stageTarget');
  assert.equal(result.pendingChoice?.effect, 'addModifier');
  assert.equal(result.pendingChoice?.meta?.kind, 'arts');
  assert.equal(result.pendingChoice?.meta?.amount, 20);
});

test('hBP07-006 can use its prior-opponent-turn KO Oshi skill after an own effect caused the KO', () => {
  const game = stateWithOwnEffectKnockout();
  game.players[0].oshi = inst('hBP07-006', 'azki-oshi');
  game.players[0].holoPower = [inst('hY01-001', 'power')];
  game.players[0].mainDeck = [inst('hBP05-079', 'event-in-deck')];

  const result = applyAction(game, 0, { type: 'oshiSkill' }, pool, () => 0);
  assert.equal(result.pendingChoice?.type, 'cardSelection');
  assert.equal(result.pendingChoice?.optional, false);
  assert.deepEqual(result.pendingChoice?.selectableIds, ['event-in-deck']);
});
