import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cards, pool, state, unit, inst, fund, attack } from './fixtures/simulator-audit.mjs';

const engineUrl = process.env.HOLO_ENGINE_PATH
  ? pathToFileURL(resolve(process.env.HOLO_ENGINE_PATH))
  : new URL('../lib/simulator/engine.mjs', import.meta.url);
const { applyAction } = await import(engineUrl);

test('hBP05-011 counts distinct-name third-generation Holomen for its Arts bonus', () => {
  const game = state('hBP05-011');
  fund(game.players[0].zones.center, ['白', '無色']);
  game.players[0].zones.back1 = unit('hBP05-012');
  game.players[0].zones.back2 = unit('hBP05-014');

  const resolved = applyAction(game, 0, attack, pool, () => 0);

  assert.equal(resolved.players[1].zones.center.damage, 60, 'duplicate Noel counts once and the distinct Pekora adds the second +10 to the printed 40');
});

for (const [oshiNumber, expectedDraw] of [['hYS01-001', 1], ['hYS01-002', 0]]) {
  test(`hBP05-015 Arts draws only when the Oshi is white (${oshiNumber})`, () => {
    const game = state('hBP05-015');
    game.players[0].oshi = inst(oshiNumber);
    fund(game.players[0].zones.center, cards.find(card => card.number === 'hBP05-015').arts[1].cost);

    const resolved = applyAction(game, 0, { ...attack, artIndex: 1 }, pool, () => 0);

    assert.equal(resolved.players[0].hand.length, expectedDraw);
    assert.equal(resolved.players[1].zones.center.damage, 30);
  });
}

test('hBP05-017 Arts may attach an archived Lunaite only to its source Holomen', () => {
  let game = state('hBP05-017');
  fund(game.players[0].zones.center, ['白', '無色']);
  game.players[0].zones.back1 = unit('hBP05-017', { stack: [inst('hBP05-017', 'other-luna')] });
  game.players[0].archive = [inst('hBP03-105', 'archived-lunaite')];

  game = applyAction(game, 0, attack, pool, () => 0);

  assert.equal(game.pendingChoice?.effect, 'genericArchiveSupportPick');
  assert.equal(game.pendingChoice?.optional, true, 'the printed "can attach" effect is optional');
  game = applyAction(game, 0, { type: 'choose', cardIds: ['archived-lunaite'] }, pool, () => 0);
  assert.equal(game.pendingChoice?.type, 'attachArchivedSupport');
  assert.deepEqual(game.pendingChoice?.options, ['center'], 'the selected fan must attach to the Art source');
  game = applyAction(game, 0, { type: 'choose', zone: 'center' }, pool, () => 0);

  assert.ok(game.players[0].zones.center.attachments.some(card => card.id === 'archived-lunaite'));
  assert.equal(game.players[0].zones.back1.attachments.length, 0);
  assert.equal(game.players[0].archive.some(card => card.id === 'archived-lunaite'), false);
});

test('hBP05-017 Arts can decline the optional archived Lunaite attachment', () => {
  let game = state('hBP05-017');
  fund(game.players[0].zones.center, ['白', '無色']);
  game.players[0].archive = [inst('hBP03-105', 'archived-lunaite')];

  game = applyAction(game, 0, attack, pool, () => 0);
  assert.equal(game.pendingChoice?.effect, 'genericArchiveSupportPick');
  game = applyAction(game, 0, { type: 'choose', skip: true }, pool, () => 0);

  assert.equal(game.players[0].archive[0]?.id, 'archived-lunaite');
  assert.equal(game.players[0].zones.center.attachments.length, 0);
});

test('hBP05-017 Collab Arts reduces only its colorless cost by Lunaite on own Center', () => {
  const game = state('hBP05-017');
  game.players[0].zones.center = unit('hBP05-017', {
    attachments: [inst('hBP03-105', 'center-lunaite-1'), inst('hBP03-105', 'center-lunaite-2')],
  });
  game.players[0].zones.collab = unit('hBP05-017');
  fund(game.players[0].zones.collab, ['白']);

  const resolved = applyAction(game, 0, { ...attack, sourceZone: 'collab', artIndex: 1 }, pool, () => 0);

  assert.equal(resolved.players[1].zones.center.damage, 80);
  assert.equal(resolved.players[0].zones.collab.rested, true);
});

test('hBP05-017 Buzz Extra loses two Life total when it is knocked out', () => {
  const game = state('AUDIT-DUMMY', 'hBP05-017');
  game.players[1].zones.center = unit('hBP05-017', { damage: 140 });

  const resolved = applyAction(game, 0, attack, pool, () => 0);

  assert.equal(resolved.players[1].life.length, 3);
  assert.equal(resolved.lifeLosses.filter(loss => loss.ownerIndex === 1).length, 2);
});
