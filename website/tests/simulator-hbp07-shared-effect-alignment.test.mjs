import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, inst, state, unit, fund, attack } from './fixtures/simulator-audit.mjs';

const card = (number) => cards.find((entry) => entry.number === number);

test('hBP07-028 Collab searches exactly the top two and returns the remainder to the top', () => {
  let game = state('AUDIT-DUMMY');
  game.phase = 'main';
  game.players[0].zones.back1 = unit('hBP07-028');
  game.players[0].mainDeck = [
    inst('hBP01-102', 'collab-power'),
    inst('hBP01-102', 'look-first'),
    inst('hBP07-033', 'look-second'),
  ];

  game = applyAction(game, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.equal(game.players[0].holoPower[0].id, 'collab-power');
  assert.equal(game.pendingChoice?.effect, 'genericTopLook');
  assert.deepEqual(game.pendingChoice?.cards.map((entry) => entry.id), ['look-first', 'look-second']);
  assert.equal(game.pendingChoice?.meta.remainder, 'top');

  game = applyAction(game, 0, { type: 'choose', cardIds: ['look-second'] }, pool, () => 0);
  assert.equal(game.pendingChoice?.effect, 'topOrder');
  game = applyAction(game, 0, { type: 'choose', cardIds: ['look-first'] }, pool, () => 0);
  assert.ok(game.players[0].hand.some((entry) => entry.id === 'look-second'));
  assert.equal(game.players[0].mainDeck[0].id, 'look-first');
});

test('hBP07-030 Arts makes the two-Cheer archive optional, then draws two only after payment', () => {
  const start = () => {
    const game = state('hBP07-030', 'AUDIT-DUMMY');
    fund(game.players[0].zones.center, card('hBP07-030').arts[0].cost);
    game.players[0].zones.center.cheer.push(inst('hY01-001', 'extra1'), inst('hY01-001', 'extra2'));
    game.players[0].mainDeck = [inst('hBP01-102', 'top1'), inst('hBP01-102', 'top2'), inst('hBP01-102', 'next')];
    return applyAction(game, 0, attack, pool, () => 0);
  };

  let game = start();
  assert.equal(game.pendingChoice?.effect, 'genericKeywordCheerCost');
  assert.equal(game.pendingChoice?.optional, true);
  assert.equal(game.pendingChoice?.meta.remaining, 2);
  game = applyAction(game, 0, { type: 'choose', skip: true }, pool, () => 0);
  assert.equal(game.players[0].archive.some((entry) => entry.id === 'extra1' || entry.id === 'extra2'), false);
  assert.equal(game.players[0].hand.length, 0);

  game = start();
  game = applyAction(game, 0, { type: 'choose', cheerId: 'extra1' }, pool, () => 0);
  assert.equal(game.pendingChoice?.optional, false);
  assert.equal(game.pendingChoice?.meta.remaining, 1);
  game = applyAction(game, 0, { type: 'choose', cheerId: 'extra2' }, pool, () => 0);
  assert.ok(game.players[0].archive.some((entry) => entry.id === 'extra1'));
  assert.ok(game.players[0].archive.some((entry) => entry.id === 'extra2'));
  assert.deepEqual(game.players[0].hand.map((entry) => entry.id), ['top1', 'top2']);
  assert.equal(game.players[0].mainDeck[0].id, 'next');
});

test('hBP07-031 Bloom optionally archives the top two Holo Power before drawing two', () => {
  const bloom = card('hBP07-031');
  const prior = cards.find((entry) => entry.jpName === bloom.jpName && entry.stage === 'Debut');
  let game = state(prior.number, 'AUDIT-DUMMY');
  game.phase = 'main';
  game.players[0].hand = [inst(bloom.number, 'bloom')];
  game.players[0].holoPower = [inst('AUDIT-DUMMY', 'power1'), inst('AUDIT-DUMMY', 'power2')];
  game.players[0].mainDeck = [inst('hBP01-102', 'top1'), inst('hBP01-102', 'top2'), inst('hBP01-102', 'next')];

  game = applyAction(game, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
  game = applyAction(game, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(game.pendingChoice?.effect, 'genericKeywordPowerCost');
  assert.equal(game.pendingChoice?.optional, true);
  assert.equal(game.pendingChoice?.meta.amount, 2);

  game = applyAction(game, 0, { type: 'choose', optionId: 'use' }, pool, () => 0);
  assert.deepEqual(game.players[0].archive.map((entry) => entry.id), ['power2', 'power1']);
  assert.deepEqual(game.players[0].hand.map((entry) => entry.id), ['top1', 'top2']);
  assert.equal(game.players[0].mainDeck[0].id, 'next');
});

test('hBP07-034 Arts combines its own +10 with Fugutaro support +10 only when attached', () => {
  const bloom = card('hBP07-034');
  const fugutaro = card('hSD10-013');
  const resolve = (withFugutaro) => {
    const game = state(bloom.number, 'AUDIT-DUMMY');
    fund(game.players[0].zones.center, bloom.arts[0].cost);
    if (withFugutaro) game.players[0].zones.center.attachments = [inst(fugutaro.number, 'fugutaro')];
    return applyAction(game, 0, attack, pool, () => 0);
  };

  assert.equal(resolve(false).players[1].zones.center.damage, 20);
  assert.equal(resolve(true).players[1].zones.center.damage, 40);
});

test('hBP07-043 Arts draws one card for each attached 35P and keeps its per-card +70', () => {
  for (const count of [0, 1, 2]) {
    const game = state('hBP07-043', 'AUDIT-DUMMY');
    const source = game.players[0].zones.center;
    fund(source, card('hBP07-043').arts[0].cost);
    source.attachments = Array.from({ length: count }, (_, index) => inst('hBP03-107', `35p-${index}`));
    game.players[0].mainDeck = Array.from({ length: count }, (_, index) => inst('AUDIT-DUMMY', `draw-${index}`));

    const result = applyAction(game, 0, attack, pool, () => 0);

    assert.equal(result.players[1].zones.center.damage, 70 + count * 70);
    assert.deepEqual(result.players[0].hand.map((entry) => entry.id), Array.from({ length: count }, (_, index) => `draw-${index}`));
  }
});
