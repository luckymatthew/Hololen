import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, inst, state, unit, fund, attack } from './fixtures/simulator-audit.mjs';

test('hBP07-052 Collab optionally attaches an archived Mascot to the Collab Holomen', () => {
  const mascot = cards.find((card) => card.typeCode === 'supportMascot');
  const game = state();
  game.phase = 'main';
  game.players[0].zones.back1 = unit('hBP07-052');
  game.players[0].archive = [inst(mascot.number, 'mascot')];

  let result = applyAction(game, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);

  assert.equal(result.pendingChoice?.effect, 'genericArchiveSupportPick');
  assert.equal(result.pendingChoice?.optional, true);
  assert.deepEqual(result.pendingChoice?.selectableIds, ['mascot']);
  result = applyAction(result, 0, { type: 'choose', cardIds: ['mascot'] }, pool, () => 0);
  assert.equal(result.pendingChoice?.type, 'attachArchivedSupport');
  assert.deepEqual(result.pendingChoice?.options, ['collab']);
  result = applyAction(result, 0, { type: 'choose', zone: 'collab' }, pool, () => 0);

  assert.equal(result.players[0].zones.collab.attachments[0].id, 'mascot');
  assert.deepEqual(result.players[0].archive, []);
});

for (const [number, previous, amount] of [['hBP07-053', 'hBP07-050', 20], ['hBP07-055', 'hBP07-052', 50]]) {
  test(`${number} Bloom targets one own #Promise Holomen for its Arts modifier`, () => {
    const game = state(previous);
    game.phase = 'main';
    game.players[0].hand = [inst(number, 'bloom')];
    game.players[0].zones.back1 = unit('hBP07-052');

    let result = applyAction(game, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
    result = applyAction(result, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
    assert.equal(result.pendingChoice?.effect, 'addModifier');
    assert.equal(result.pendingChoice?.optional, false);
    assert.deepEqual(result.pendingChoice?.options, ['center', 'back1']);
    result = applyAction(result, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);

    assert.ok(result.players[0].zones.back1.modifiers.some((modifier) => modifier.kind === 'arts' && modifier.amount === amount && modifier.expiresTurn === result.turn));
  });
}

test('hBP07-055 basic Arts adds its printed white-target bonus', () => {
  const whiteTarget = cards.find((card) => card.group === 'holomem' && card.colors.includes('白') && card.stage === '1st');
  const game = state('hBP07-055', whiteTarget.number);
  fund(game.players[0].zones.center, cards.find((card) => card.number === 'hBP07-055').arts[0].cost);

  const result = applyAction(game, 0, attack, pool, () => 0);

  assert.equal(result.players[1].zones.center.damage, 140);
});

test('hBP07-056 central Gift offers one underlying Bloom source and resolves on another Kronii', () => {
  const kroniiDebut = cards.find((card) => card.group === 'holomem' && card.jpName === 'オーロ・クロニー' && card.stage === 'Debut');
  const game = state();
  game.phase = 'main';
  game.players[0].zones.center = unit('hBP07-056', { stack: [inst('hBP07-052', 'under'), inst('hBP07-056', 'source')] });
  game.players[0].zones.back1 = unit(kroniiDebut.number);

  let result = applyAction(game, 0, { type: 'advance' }, pool, () => 0);
  assert.equal(result.phase, 'performance');
  assert.equal(result.pendingChoice?.effect, 'giftKroniiBloomCard');
  assert.equal(result.pendingChoice?.optional, true);
  assert.deepEqual(result.pendingChoice?.selectableIds, ['under']);
  result = applyAction(result, 0, { type: 'choose', cardIds: ['under'] }, pool, () => 0);
  assert.equal(result.pendingChoice?.effect, 'giftKroniiBloom');
  assert.deepEqual(result.pendingChoice?.options, ['back1']);
  result = applyAction(result, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);

  assert.equal(result.players[0].zones.center.stack.length, 1, 'the chosen underlying Holomen is used');
  assert.equal(result.players[0].zones.back1.stack.at(-1).number, 'hBP07-052');
});

test('hBP07-057 Collab directs its mandatory 30 special damage to one opponent Holomen', () => {
  const game = state();
  game.phase = 'main';
  game.players[0].zones.back1 = unit('hBP07-057');
  game.players[1].zones.back1 = unit('AUDIT-DUMMY');

  let result = applyAction(game, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.equal(result.pendingChoice?.effect, 'specialDamage');
  assert.equal(result.pendingChoice?.optional, false);
  assert.deepEqual(result.pendingChoice?.options, ['center', 'back1']);
  result = applyAction(result, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);

  assert.equal(result.players[1].zones.center.damage, 0);
  assert.equal(result.players[1].zones.back1.damage, 30);
});

test('hBP07-059 Arts lets the player choose any opponent Holomen for its special damage', () => {
  const game = state('hBP07-059');
  game.players[1].zones.collab = unit('AUDIT-DUMMY');
  game.players[1].zones.back1 = unit('AUDIT-DUMMY');
  fund(game.players[0].zones.center, ['無色']);

  let result = applyAction(game, 0, { ...attack, targetZone: 'collab' }, pool, () => 0);

  assert.equal(result.pendingChoice?.effect, 'specialDamage');
  assert.equal(result.pendingChoice?.targetPlayerIndex, 1);
  assert.equal(result.pendingChoice?.optional, false);
  assert.deepEqual(result.pendingChoice?.options, ['center', 'collab', 'back1']);

  result = applyAction(result, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);

  assert.equal(result.players[1].zones.center.damage, 0);
  assert.equal(result.players[1].zones.collab.damage, 10, 'normal Arts damage stays on the selected Arts target');
  assert.equal(result.players[1].zones.back1.damage, 10, 'special damage uses the separately selected Holomen');
});
