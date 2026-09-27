import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, inst, unit, state, fund, attack } from './fixtures/simulator-audit.mjs';

test('hBP07-100 counts archived copies after committing this event and resolves one Cheer per copy', () => {
  let game = state('hBP07-064');
  game.phase = 'main';
  game.players[0].hand = [inst('hBP07-100', 'event1'), inst('hBP07-100', 'event2')];
  game.players[0].archive = [
    inst('hBP07-100', 'old1'),
    inst('hBP07-100', 'old2'),
    inst('hBP07-064', 'azki'),
    inst('hY01-001', 'cheer1'),
    inst('hY02-001', 'cheer2'),
    inst('hY03-001', 'cheer3'),
  ];

  game = applyAction(game, 0, { type: 'play', cardId: 'event1' }, pool, () => 0);
  assert.equal(game.pendingChoice.effect, 'frontierReturn');
  game = applyAction(game, 0, { type: 'choose', cardIds: ['azki'] }, pool, () => 0);
  for (const cheerId of ['cheer1', 'cheer2', 'cheer3']) {
    assert.equal(game.pendingChoice.optional, false);
    game = applyAction(game, 0, { type: 'choose', cardIds: [cheerId] }, pool, () => 0);
    game = applyAction(game, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  }
  assert.equal(game.players[0].hand.some((card) => card.id === 'azki'), true);
  assert.deepEqual(game.players[0].zones.center.cheer.map((card) => card.id), ['cheer1', 'cheer2', 'cheer3']);
  assert.equal(game.players[0].archive.filter((card) => card.number === 'hBP07-100').length, 3);
  assert.throws(() => applyAction(game, 0, { type: 'play', cardId: 'event2' }, pool, () => 0), /本回合已使用/u);
});

test('hBP07-101 reduces one Colorless Arts cost only for Buzz Holomen', () => {
  const buzz = state('hBP07-019');
  buzz.players[0].zones.center.attachments = [inst('hBP07-101', 'mic-buzz')];
  fund(buzz.players[0].zones.center, ['白']);
  const resolved = applyAction(buzz, 0, attack, pool, () => 0);
  assert.equal(resolved.players[1].zones.center.damage, 50);

  const nonBuzz = state('hBP07-017');
  nonBuzz.players[0].zones.center.attachments = [inst('hBP07-101', 'mic-nonbuzz')];
  fund(nonBuzz.players[0].zones.center, ['白']);
  assert.throws(() => applyAction(nonBuzz, 0, attack, pool, () => 0), /費用|應援/u);
});

test('hBP07-102 grants Watame +20 Arts and the Center 2nd bonus, then rolls for another own Holomen', () => {
  let game = state('hBP07-014');
  game.players[0].zones.center.attachments = [inst('hBP07-102', 'hammer')];
  game.players[0].zones.back1 = unit('hBP07-023');
  fund(game.players[0].zones.center, ['白', '白', '無色']);

  game = applyAction(game, 0, attack, pool, () => 0.4); // 3
  assert.equal(game.pendingChoice.type, 'stageTarget');
  assert.equal(game.pendingChoice.effect, 'specialDamage');
  game = applyAction(game, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
  assert.equal(game.players[0].zones.back1.damage, 50);
  assert.equal(game.players[1].zones.center.damage, 210);
});

test('hBP07-102 does not queue its 50 special damage on a non-triggering die result', () => {
  let game = state('hBP07-014');
  game.players[0].zones.center.attachments = [inst('hBP07-102', 'hammer')];
  game.players[0].zones.back1 = unit('hBP07-023');
  fund(game.players[0].zones.center, ['白', '白', '無色']);

  game = applyAction(game, 0, attack, pool, () => 0.5); // 4
  assert.equal(game.pendingChoice, null);
  assert.equal(game.players[0].zones.back1.damage, 0);
  assert.equal(game.players[1].zones.center.damage, 210);
});

test('hBP07-103 grants Nene +20 Arts; its damage-reduction exception is covered by the shared regression', () => {
  const game = state('hBP07-080');
  game.players[0].zones.center.attachments = [inst('hBP07-103', 'beetle')];
  fund(game.players[0].zones.center, ['黃']);
  const resolved = applyAction(game, 0, attack, pool, () => 0);
  assert.equal(resolved.players[1].zones.center.damage, 60);
});

test('hBP07-104 gives Elizabeth +20, with the extra +20 only for damaged 2nd Elizabeth', () => {
  const cases = [
    { card: 'hBP07-047', damage: 10, expected: 70 },
    { card: 'hBP07-049', damage: 0, expected: 150 },
    { card: 'hBP07-049', damage: 10, expected: 170 },
  ];
  for (const { card, damage, expected } of cases) {
    const game = state(card);
    game.players[0].zones.center.damage = damage;
    game.players[0].zones.center.attachments = [inst('hBP07-104', `thorn-${card}-${damage}`)];
    fund(game.players[0].zones.center, cards.find((entry) => entry.number === card).arts[0].cost);
    const resolved = applyAction(game, 0, attack, pool, () => 0);
    assert.equal(resolved.players[1].zones.center.damage, expected, `${card} with ${damage} damage`);
  }
});

test('hBP07-106 and hBP07-107 each add 20 HP to their attached Holomen', () => {
  for (const mascot of ['hBP07-106', 'hBP07-107']) {
    const game = state('hBP07-049', 'hBP07-023');
    game.players[1].zones.center.attachments = [inst(mascot, mascot)];
    fund(game.players[0].zones.center, ['紅', '無色', '無色']);
    const resolved = applyAction(game, 0, attack, pool, () => 0);
    assert.ok(resolved.players[1].zones.center, `${mascot} keeps Mio alive through 130 damage`);
    assert.equal(resolved.players[1].zones.center.damage, 130);
    assert.equal(resolved.players[1].life.length, 5);
  }
});

test('hBP07-108 counts as White Cheer only while the player has Zeta as Oshi', () => {
  const valid = state('hBP07-018');
  valid.players[0].oshi = inst('hBP07-002');
  valid.players[0].zones.center.attachments = [inst('hBP07-108', 'secretary')];
  const resolved = applyAction(valid, 0, attack, pool, () => 0);
  assert.equal(resolved.players[1].zones.center.damage, 30);

  const wrongOshi = state('hBP07-018');
  wrongOshi.players[0].oshi = inst('hBP07-001');
  wrongOshi.players[0].zones.center.attachments = [inst('hBP07-108', 'secretary')];
  assert.throws(() => applyAction(wrongOshi, 0, attack, pool, () => 0), /費用|應援/u);
});
