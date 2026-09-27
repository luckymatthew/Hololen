import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, inst, state, unit, fund, attack } from './fixtures/simulator-audit.mjs';

const card = (number) => cards.find((entry) => entry.number === number);

for (const [number, artIndex] of [['hBP07-060', 0], ['hBP07-063', 0], ['hBP07-065', 1], ['hBP07-066', 0]]) {
  test(`${number} Arts ${artIndex} uses its printed basic cost and damage`, () => {
    const game = state(number);
    const art = card(number).arts[artIndex];
    fund(game.players[0].zones.center, art.cost);

    const result = applyAction(game, 0, { ...attack, artIndex }, pool, () => 0);

    assert.equal(result.players[1].zones.center.damage, art.damage);
  });
}

test('hBP07-060 second Arts requires four Support cards in the Archive', () => {
  const support = cards.find((entry) => entry.group === 'support');
  const canAttack = (count) => {
    const game = state('hBP07-060');
    fund(game.players[0].zones.center, card('hBP07-060').arts[1].cost);
    game.players[0].archive = Array.from({ length: count }, (_, index) => inst(support.number, `support-${index}`));
    return applyAction(game, 0, { ...attack, artIndex: 1 }, pool, () => 0);
  };

  assert.throws(() => canAttack(3), /存檔區最少需要 4 張支援卡/u);
  assert.equal(canAttack(4).players[1].zones.center.damage, 50);
});

for (const pay of [true, false]) {
  test(`hBP07-062 Collab cost archives exactly two Support cards and gates its +50 Arts choice (${pay})`, () => {
    const support = cards.find((entry) => entry.group === 'support');
    const game = state();
    game.phase = 'main';
    game.players[0].zones.back1 = unit('hBP07-062');
    game.players[0].hand = [inst(support.number, 'support-1'), inst(support.number, 'support-2'), inst('AUDIT-DUMMY', 'non-support')];

    let result = applyAction(game, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(result.pendingChoice?.effect, 'genericKeywordHandArchiveCost');
    assert.equal(result.pendingChoice?.optional, true);
    assert.equal(result.pendingChoice?.min, 2);
    assert.deepEqual(result.pendingChoice?.selectableIds, ['support-1', 'support-2']);

    result = applyAction(result, 0, pay
      ? { type: 'choose', cardIds: ['support-1', 'support-2'] }
      : { type: 'choose', skip: true }, pool, () => 0);

    if (pay) {
      assert.equal(result.pendingChoice?.effect, 'addModifier');
      assert.deepEqual(result.pendingChoice?.options, ['center', 'collab']);
      result = applyAction(result, 0, { type: 'choose', zone: 'collab' }, pool, () => 0);
      assert.ok(result.players[0].archive.some((entry) => entry.id === 'support-1'));
      assert.ok(result.players[0].archive.some((entry) => entry.id === 'support-2'));
      assert.equal(result.players[0].hand[0].id, 'non-support');
      assert.ok(result.players[0].zones.collab.modifiers.some((modifier) => modifier.kind === 'arts' && modifier.amount === 50 && modifier.expiresTurn === result.turn));
    } else {
      assert.equal(result.pendingChoice, null);
      assert.deepEqual(result.players[0].hand.map((entry) => entry.id), ['support-1', 'support-2', 'non-support']);
      assert.equal(result.players[0].archive.length, 0);
      assert.equal(result.players[0].zones.collab.modifiers.length, 0);
    }
  });
}

test('hBP07-063 qualifying AZKi Collab returns the chosen opponent Cheer to the bottom', () => {
  const azki = cards.find((entry) => entry.group === 'oshi' && entry.jpName === 'AZKi');
  const game = state();
  game.phase = 'main';
  game.firstPlayer = 1;
  game.players[0].turnsTaken = 1;
  game.players[0].oshi = inst(azki.number);
  game.players[0].zones.back1 = unit('hBP07-063');
  game.players[1].zones.center.cheer = [inst('hY05-001', 'opponent-cheer')];
  game.players[1].cheerDeck = [inst('hY04-001', 'existing-bottom')];

  let result = applyAction(game, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.equal(result.pendingChoice?.effect, 'opponentCheerBottom');
  assert.equal(result.pendingChoice?.optional, true);
  result = applyAction(result, 0, { type: 'choose', zone: 'center', cheerId: 'opponent-cheer' }, pool, () => 0);

  assert.deepEqual(result.players[1].zones.center.cheer, []);
  assert.deepEqual(result.players[1].cheerDeck.map((entry) => entry.id), ['existing-bottom', 'opponent-cheer']);
});

test('hBP07-065 first Arts draws one before requiring one hand card for Archive', () => {
  const game = state('hBP07-065');
  fund(game.players[0].zones.center, card('hBP07-065').arts[0].cost);
  game.players[0].hand = [inst('AUDIT-DUMMY', 'keep')];
  game.players[0].mainDeck = [inst('AUDIT-DUMMY', 'drawn')];

  let result = applyAction(game, 0, { ...attack, artIndex: 0 }, pool, () => 0);
  assert.equal(result.pendingChoice?.effect, 'handToArchive');
  assert.deepEqual(result.pendingChoice?.cards.map((entry) => entry.id), ['keep', 'drawn']);
  result = applyAction(result, 0, { type: 'choose', cardIds: ['keep'] }, pool, () => 0);

  assert.deepEqual(result.players[0].hand.map((entry) => entry.id), ['drawn']);
  assert.deepEqual(result.players[0].archive.map((entry) => entry.id), ['keep']);
});

test('hBP07-066 Collab resolves its 30 HP recovery before the optional Arts +10 target step', () => {
  const game = state();
  game.phase = 'main';
  game.players[0].zones.center = unit('hBP07-063', { damage: 50 });
  game.players[0].zones.back1 = unit('hBP07-066');

  let result = applyAction(game, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.equal(result.pendingChoice?.effect, 'healThenArtsChoice');
  result = applyAction(result, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(result.players[0].zones.center.damage, 20);
  assert.equal(result.pendingChoice?.effect, 'addModifier');
  assert.deepEqual(result.pendingChoice?.options, ['center', 'collab']);
  result = applyAction(result, 0, { type: 'choose', zone: 'collab' }, pool, () => 0);

  assert.ok(result.players[0].zones.collab.modifiers.some((modifier) => modifier.kind === 'arts' && modifier.amount === 10 && modifier.expiresTurn === result.turn));
});
