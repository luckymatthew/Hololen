import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, inst, state, unit, fund, attack } from './fixtures/simulator-audit.mjs';

const card = (number) => cards.find((entry) => entry.number === number);

test('hBP07-046, hBP07-047 and hBP07-051 plain Arts use their printed costs and damage', () => {
  for (const number of ['hBP07-046', 'hBP07-047', 'hBP07-051']) {
    const game = state(number);
    const art = card(number).arts[0];
    fund(game.players[0].zones.center, art.cost);

    const result = applyAction(game, 0, attack, pool, () => 0);

    assert.equal(result.players[1].zones.center.damage, art.damage, number);
  }
});

test('hBP07-045 Arts gains 20 for each card in hand', () => {
  const game = state('hBP07-045');
  fund(game.players[0].zones.center, card('hBP07-045').arts[0].cost);
  game.players[0].hand = [inst('AUDIT-DUMMY', 'hand-1'), inst('AUDIT-DUMMY', 'hand-2'), inst('AUDIT-DUMMY', 'hand-3')];

  const result = applyAction(game, 0, attack, pool, () => 0);

  assert.equal(result.players[1].zones.center.damage, 80);
});

test('hBP07-047 Oshi condition gates the top-deck Holo Power effect', () => {
  const run = (oshiNumber) => {
    const game = state('hBP07-047');
    game.phase = 'main';
    game.firstPlayer = 1;
    game.players[0].turnsTaken = 2;
    game.players[0].oshi = inst(oshiNumber);
    game.players[0].zones.back1 = unit('hBP07-047');
    game.players[0].mainDeck = [inst('AUDIT-DUMMY', 'collab-power'), inst('hY01-001', 'effect-top')];
    return applyAction(game, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  };

  const enabled = run('hSD13-001');
  assert.deepEqual(enabled.players[0].holoPower.map((entry) => entry.id), ['collab-power', 'effect-top']);
  assert.deepEqual(enabled.players[0].mainDeck, []);

  const disabled = run('hBD24-001');
  assert.deepEqual(disabled.players[0].holoPower.map((entry) => entry.id), ['collab-power']);
  assert.deepEqual(disabled.players[0].mainDeck.map((entry) => entry.id), ['effect-top']);
});

test('hBP07-048 can spend the copied Arts cost and use an on-stage #EN Arts', () => {
  const game = state('hBP07-048');
  const copied = card('hBP07-050');
  game.players[0].zones.back1 = unit(copied.number);
  fund(game.players[0].zones.center, copied.arts[0].cost);

  const result = applyAction(game, 0, { ...attack, artSourceNumber: copied.number }, pool, () => 0);

  assert.equal(result.players[1].zones.center.damage, copied.arts[0].damage);
  assert.equal(result.players[0].zones.center.rested, true);
  assert.equal(result.pendingChoice, null, 'copying another Holomem Arts must not run hBP07-048 own Arts recovery');
});

test('hBP07-049 Arts uses +30 at 3–4 life and +60 at 1–2 life', () => {
  const damageAtLife = (life) => {
    const game = state('hBP07-049');
    game.players[0].life = game.players[0].life.slice(0, life);
    fund(game.players[0].zones.center, card('hBP07-049').arts[0].cost);
    return applyAction(game, 0, attack, pool, () => 0).players[1].zones.center.damage;
  };

  assert.deepEqual([5, 4, 3, 2, 1].map(damageAtLife), [130, 160, 160, 190, 190]);
});

test('hBP07-049 knockout Gift grants the chosen own Holomem -2 colorless Arts cost', () => {
  const game = state('hBP07-049');
  game.players[0].zones.back1 = unit('hBP07-050');
  game.players[1].zones.center = unit('AUDIT-DUMMY', { damage: 9990 });
  game.players[1].zones.back1 = unit('AUDIT-DUMMY');
  fund(game.players[0].zones.center, card('hBP07-049').arts[0].cost);

  let result = applyAction(game, 0, attack, pool, () => 0);
  assert.equal(result.pendingChoice?.effect, 'addModifier');
  assert.ok(result.pendingChoice.options.includes('back1'));
  result = applyAction(result, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);

  assert.ok(result.players[0].zones.back1.modifiers.some((modifier) => modifier.kind === 'artCost' && modifier.amount === -2));
});

test('hBP07-050 grants the second player a first-turn hand-to-center Bloom', () => {
  const game = state('hBP07-050');
  game.phase = 'main';
  game.firstPlayer = 1;
  game.players[0].turnsTaken = 1;
  game.players[0].zones.center = unit('hBP07-050');
  game.players[0].zones.back1 = unit('hBP07-050');
  game.players[0].hand = [inst('hBP07-052', 'bloom')];
  game.players[0].mainDeck = [inst('AUDIT-DUMMY', 'collab-power'), inst('hY01-001', 'top')];

  let result = applyAction(game, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.equal(result.pendingChoice?.effect, 'kroniiFirstTurnBloomCard');
  result = applyAction(result, 0, { type: 'choose', cardIds: ['bloom'] }, pool, () => 0);
  assert.equal(result.pendingChoice?.effect, 'kroniiFirstTurnBloom');
  result = applyAction(result, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(result.players[0].zones.center.stack.at(-1).number, 'hBP07-052');
});

test('hBP07-051 moves one actual Cheer to a different #Promise Holomem', () => {
  const game = state('hBP07-051');
  game.phase = 'main';
  game.firstPlayer = 1;
  game.players[0].zones.center = unit('hBP07-050');
  game.players[0].zones.back1 = unit('hBP07-051', { cheer: [inst('hY03-001', 'move')] });
  game.players[0].zones.back2 = unit('hBP01-032');
  game.players[0].mainDeck = [inst('AUDIT-DUMMY', 'collab-power'), inst('hY01-001', 'top')];

  let result = applyAction(game, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.equal(result.pendingChoice?.effect, 'genericMoveCheer');
  assert.equal(result.pendingChoice?.optional, true);
  assert.deepEqual(result.pendingChoice.options, ['move']);
  result = applyAction(result, 0, { type: 'choose', cheerId: 'move' }, pool, () => 0);
  assert.deepEqual(result.pendingChoice?.options, ['center']);
  result = applyAction(result, 0, { type: 'choose', zone: 'center' }, pool, () => 0);

  assert.equal(result.players[0].zones.collab.cheer.length, 0);
  assert.equal(result.players[0].zones.center.cheer[0].number, 'hY03-001');
});
