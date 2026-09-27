import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { pool, inst, unit, state, fund, attack } from './fixtures/simulator-audit.mjs';

test('hBP08-028 Arts heals an own damaged Holomen with a Tool attached', () => {
  let game = state('hBP08-028');
  fund(game.players[0].zones.center, ['綠', '無色']);
  game.players[0].zones.back1 = unit('AUDIT-DUMMY', { damage: 60, attachments: [inst('hBP01-114', 'tool-target')] });
  game.players[0].zones.back2 = unit('AUDIT-DUMMY', { damage: 60 });

  game = applyAction(game, 0, attack, pool, () => 0);

  assert.equal(game.pendingChoice?.effect, 'heal');
  assert.deepEqual(game.pendingChoice.options, ['back1']);
  game = applyAction(game, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
  assert.equal(game.players[0].zones.back1.damage, 30);
  assert.equal(game.players[0].zones.back2.damage, 60);
});

test('hBP08-031 archives a Cheer through its Arts and triggers its Center Gift', () => {
  let game = state('hBP08-031');
  fund(game.players[0].zones.center, ['綠', '無色']);
  game.players[0].cheerDeck = [inst('hY05-001', 'archived-cheer')];
  const handBefore = game.players[0].hand.length;

  game = applyAction(game, 0, attack, pool, () => 0);

  assert.ok(game.players[0].archive.some((card) => card.id === 'archived-cheer'));
  assert.equal(game.players[0].hand.length, handBefore + 1, 'the Cheer archive should draw exactly one card');
  assert.ok(game.log.some((entry) => String(entry.message || entry).includes('SPY-C1000')));
});

test('hBP08-032 Arts bonus requires another #ID2 unit with Purple or Yellow Cheer', () => {
  for (const cheer of ['hY05-001', 'hY06-001']) {
    let game = state('hBP08-032');
    fund(game.players[0].zones.center, ['無色', '無色']);
    game.players[0].zones.center.cheer.push(inst('hY05-001', `source-${cheer}`));
    game.players[0].zones.back1 = unit('hBP08-030', { cheer: [inst(cheer, `other-${cheer}`)] });

    game = applyAction(game, 0, attack, pool, () => 0);
    assert.equal(game.players[1].zones.center.damage, 150, `${cheer} on another #ID2 unit should grant +70`);
  }

  let game = state('hBP08-032');
  fund(game.players[0].zones.center, ['無色', '無色']);
  game.players[0].zones.center.cheer.push(inst('hY05-001', 'only-self-purple'));
  game = applyAction(game, 0, attack, pool, () => 0);
  assert.equal(game.players[1].zones.center.damage, 80, 'the attacker itself cannot satisfy the “another Holomen” gate');
});

test('hBP08-033 Arts adds its printed bonus only against a Blue target', () => {
  let game = state('hBP08-033', 'hBP01-081');
  fund(game.players[0].zones.center, ['綠', '無色', '無色']);

  game = applyAction(game, 0, attack, pool, () => 0);
  assert.equal(game.players[1].zones.center.damage, 190);

  game = state('hBP08-033');
  fund(game.players[0].zones.center, ['綠', '無色', '無色']);
  game = applyAction(game, 0, attack, pool, () => 0);
  assert.equal(game.players[1].zones.center.damage, 140);
});

test('hBP08-033 Arts can select one archived Cheer and attach it to an own Reine', () => {
  let game = state('hBP08-033');
  fund(game.players[0].zones.center, ['綠', '無色', '無色']);
  game.players[0].zones.back1 = unit('hBP08-030');
  game.players[0].archive = [inst('hY01-001', 'one-archived-cheer')];

  game = applyAction(game, 0, attack, pool, () => 0);
  assert.equal(game.pendingChoice?.min, 1);
  assert.equal(game.pendingChoice?.max, 1);
  game = applyAction(game, 0, { type: 'choose', cardIds: ['one-archived-cheer'] }, pool, () => 0);
  game = applyAction(game, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
  assert.equal(game.players[0].zones.back1.cheer[0].id, 'one-archived-cheer');
});
