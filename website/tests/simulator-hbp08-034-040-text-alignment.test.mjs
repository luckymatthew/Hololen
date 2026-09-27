import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, inst, unit, state, fund, attack } from './fixtures/simulator-audit.mjs';

const blue = (id) => inst('hY04-001', id);

test('hBP08-034 and hBP08-036 Arts deal their printed base damage', () => {
  for (const [number, damage] of [['hBP08-034', 30], ['hBP08-036', 40]]) {
    let game = state(number);
    fund(game.players[0].zones.center, ['無色']);
    game = applyAction(game, 0, attack, pool, () => 0);
    assert.equal(game.players[1].zones.center.damage, damage, `${number} base Arts damage`);
  }
});

test('hBP08-034 Collab effect is limited to the second player first turn', () => {
  let game = state();
  game.phase = 'main';
  game.firstPlayer = 0;
  game.players[0].turnsTaken = 1;
  game.players[0].zones.back1 = unit('hBP08-034');
  game.players[0].mainDeck = [inst('AUDIT-DUMMY', 'filler')];
  game = applyAction(game, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.equal(game.pendingChoice, null, 'the first player cannot use the first-turn search');
});

test('hBP08-035 gets +30 Arts only while Mococo has Blue Cheer', () => {
  let game = state('hBP08-035');
  fund(game.players[0].zones.center, ['紅']);
  game.players[0].zones.center.cheer.push(blue('blue-bonus'));
  game = applyAction(game, 0, attack, pool, () => 0);
  assert.equal(game.players[1].zones.center.damage, 40);

  game = state('hBP08-035');
  fund(game.players[0].zones.center, ['紅']);
  game = applyAction(game, 0, attack, pool, () => 0);
  assert.equal(game.players[1].zones.center.damage, 10);
});

test('hBP08-037 Arts attaches the Cheer deck top to own Fuwawa only with two Blue Cheer', () => {
  for (const blueCount of [1, 2]) {
    let game = state('hBP08-037');
    fund(game.players[0].zones.center, ['紅', '紅']);
    game.players[0].zones.center.cheer.push(...Array.from({ length: blueCount }, (_, i) => blue(`blue-${blueCount}-${i}`)));
    game.players[0].zones.back1 = unit('hBP03-040');
    game.players[0].cheerDeck = [blue(`top-${blueCount}`)];
    game = applyAction(game, 0, attack, pool, () => 0);

    if (blueCount === 2) {
      assert.equal(game.pendingChoice?.type, 'eventCheerTarget');
      assert.deepEqual(game.pendingChoice.options, ['back1']);
      game = applyAction(game, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
      assert.equal(game.players[0].zones.back1.cheer.at(-1).id, 'top-2');
    } else {
      assert.equal(game.pendingChoice, null);
      assert.equal(game.players[0].cheerDeck.length, 1);
    }
  }
});

test('hBP08-038 Arts gets the printed +50 only against a Green Holomen', () => {
  const green = cards.find((card) => card.group === 'holomem' && card.colors?.includes('綠') && card.hp > 150);
  assert.ok(green, 'the local card catalogue contains a Green Holomen that survives the test damage');
  let game = state('hBP08-038', green.number);
  fund(game.players[0].zones.center, ['無色', '無色']);
  game = applyAction(game, 0, attack, pool, () => 0);
  assert.equal(game.players[1].zones.center.damage, 150);

  game = state('hBP08-038');
  fund(game.players[0].zones.center, ['無色', '無色']);
  game = applyAction(game, 0, attack, pool, () => 0);
  assert.equal(game.players[1].zones.center.damage, 100);
});

test('hBP08-038 Collab optionally returns an archived Advent Holomen only with Blue FUWAMOCO Oshi', () => {
  let game = state();
  game.phase = 'main';
  game.players[0].oshi = inst('hBP03-004');
  game.players[0].zones.back1 = unit('hBP08-038');
  game.players[0].archive = [inst('hBP03-040', 'advent-member')];
  game = applyAction(game, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.equal(game.pendingChoice?.optional, true);
  assert.deepEqual(game.pendingChoice.cards.map((card) => card.id), ['advent-member']);
  game = applyAction(game, 0, { type: 'choose', cardIds: ['advent-member'] }, pool, () => 0);
  assert.ok(game.players[0].hand.some((card) => card.id === 'advent-member'));
  assert.ok(!game.players[0].archive.some((card) => card.id === 'advent-member'));

  for (const [oshi, archivedNumber] of [['AUDIT-OSHI', 'hBP03-040'], ['hBP03-004', 'hBP01-032']]) {
    game = state();
    game.phase = 'main';
    game.players[0].oshi = inst(oshi);
    game.players[0].zones.back1 = unit('hBP08-038');
    game.players[0].archive = [inst(archivedNumber, 'not-returnable')];
    game = applyAction(game, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(game.pendingChoice, null, `${oshi}/${archivedNumber} must not open an illegal recovery choice`);
  }
});

test('hBP08-039 Arts counts attached Blue Cheer before moving any chosen amount to Fuwawa', () => {
  const purple = cards.find((card) => card.group === 'holomem' && card.colors?.includes('紫') && card.hp > 180);
  assert.ok(purple, 'the local card catalogue contains a Purple Holomen that survives the test damage');
  let game = state('hBP08-039', purple.number);
  fund(game.players[0].zones.center, ['紅', '紅', '紅']);
  game.players[0].zones.center.cheer.push(blue('blue-mococo-1'), blue('blue-mococo-2'));
  game.players[0].zones.back1 = unit('hBP03-040');
  game = applyAction(game, 0, attack, pool, () => 0);
  assert.equal(game.pendingChoice?.effect, 'boundaryTransferTarget');

  game = applyAction(game, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
  const selectedId = game.pendingChoice?.cheerOptions?.[0]?.id;
  assert.ok(selectedId, 'the transfer choice exposes the source Holomen Blue Cheer');
  game = applyAction(game, 0, { type: 'choose', cheerId: selectedId }, pool, () => 0);
  assert.equal(game.players[0].zones.back1.cheer.length, 1);
  assert.equal(game.players[0].zones.center.cheer.filter((card) => card.number === 'hY04-001').length, 1);
  if (game.pendingChoice?.type === 'stageCheerSelection') game = applyAction(game, 0, { type: 'choose', skip: true }, pool, () => 0);
  assert.equal(game.players[1].zones.center.damage, 180, '90 base + 40 for two Blue Cheer + 50 versus Purple');
  assert.equal(game.players[0].zones.back1.cheer.length, 1, 'the player may transfer one of two eligible Cheer');
});

test('hBP08-039 Bloom readies a rested Fuwawa at six Stage Blue Cheer, not five', () => {
  for (const blueCount of [5, 6]) {
    let game = state('hBP08-036');
    game.phase = 'main';
    game.players[0].hand = [inst('hBP08-039', `bloom-${blueCount}`)];
    game.players[0].zones.center.cheer = Array.from({ length: blueCount - 1 }, (_, i) => blue(`center-${blueCount}-${i}`));
    game.players[0].zones.back1 = unit('hBP03-040', { rested: true, cheer: [blue(`fuwawa-${blueCount}`)] });
    game = applyAction(game, 0, { type: 'play', cardId: `bloom-${blueCount}` }, pool, () => 0);
    game = applyAction(game, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
    if (blueCount === 6) {
      assert.equal(game.pendingChoice?.effect, 'unrest');
      game = applyAction(game, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
      assert.equal(game.players[0].zones.back1.rested, false);
    } else {
      assert.equal(game.pendingChoice, null);
      assert.equal(game.players[0].zones.back1.rested, true);
    }
  }
});

test('hBP08-040 equipped Collab moves one opponent Back to Collab without triggering a Collab', () => {
  let game = state();
  game.phase = 'main';
  game.players[0].zones.back1 = unit('hBP08-040', { attachments: [inst('hBP06-098', 'weapon')] });
  game.players[1].zones.back2 = unit('AUDIT-DUMMY', { collabbedTurn: 0 });
  game = applyAction(game, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.equal(game.pendingChoice?.type, 'forcedCollab');
  assert.equal(game.pendingChoice.playerIndex, 1);
  assert.deepEqual(game.pendingChoice.options, ['back2']);
  game = applyAction(game, 1, { type: 'choose', zone: 'back2' }, pool, () => 0);
  assert.equal(game.players[1].zones.collab.stack.at(-1).number, 'AUDIT-DUMMY');
  assert.equal(game.players[1].zones.collab.collabbedTurn, 0);
  assert.equal(game.players[1].collabTurn, 0);
  assert.equal(game.pendingChoice, null);

  for (const { equipped, enemyCollab, enemyBack } of [
    { equipped: false, enemyCollab: false, enemyBack: true },
    { equipped: true, enemyCollab: true, enemyBack: true },
    { equipped: true, enemyCollab: false, enemyBack: false },
  ]) {
    game = state();
    game.phase = 'main';
    game.players[0].zones.back1 = unit('hBP08-040', { attachments: equipped ? [inst('hBP06-098', 'weapon')] : [] });
    if (enemyCollab) game.players[1].zones.collab = unit('AUDIT-DUMMY', 'occupied-collab');
    if (enemyBack) game.players[1].zones.back2 = unit('AUDIT-DUMMY', 'enemy-back');
    game = applyAction(game, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(game.pendingChoice, null, 'the weapon, empty-Collab and available-Back gates must all hold');
  }
});
