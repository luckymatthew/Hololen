import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, inst, state, attack, fund } from './fixtures/simulator-audit.mjs';

const card = (number) => cards.find((entry) => entry.number === number);

function startArt(number, topCardNumber) {
  const game = state(number, 'AUDIT-DUMMY');
  fund(game.players[0].zones.center, card(number).arts[0].cost);
  game.players[0].mainDeck = [inst(topCardNumber, 'top'), inst('AUDIT-DUMMY', 'next')];
  return applyAction(game, 0, attack, pool, () => 0);
}

for (const number of ['hBP07-028', 'hBP07-029']) {
  test(`${number} asks before optionally archiving the top main-deck card`, () => {
    const game = startArt(number, 'hBP01-102');

    assert.equal(game.pendingChoice?.type, 'optionChoice');
    assert.equal(game.pendingChoice?.optional, true);
    assert.equal(game.pendingChoice?.effect, 'hBP07MioTopArchiveArt');
    assert.equal(game.players[0].mainDeck[0].id, 'top');
    assert.equal(game.players[0].archive.some((entry) => entry.id === 'top'), false);

    const skipped = applyAction(game, 0, { type: 'choose', skip: true }, pool, () => 0);
    assert.equal(skipped.players[0].mainDeck[0].id, 'top');
    assert.equal(skipped.players[0].archive.some((entry) => entry.id === 'top'), false);
  });
}

test('hBP07-028 grants its printed +50 only for an archived Support', () => {
  const supportChoice = startArt('hBP07-028', 'hBP01-102');
  assert.equal(supportChoice.pendingChoice?.effect, 'hBP07MioTopArchiveArt');
  const resolved = applyAction(supportChoice, 0, { type: 'choose', optionId: 'archive' }, pool, () => 0);
  assert.ok(resolved.players[0].archive.some((entry) => entry.id === 'top'));
  assert.equal(resolved.players[0].mainDeck[0].id, 'next');
  assert.equal(resolved.players[1].zones.center.damage, 140);

  const holomemChoice = startArt('hBP07-028', 'AUDIT-DUMMY');
  const holomemResolved = applyAction(holomemChoice, 0, { type: 'choose', optionId: 'archive' }, pool, () => 0);
  assert.equal(holomemResolved.players[1].zones.center.damage, 90);
});

test('hBP07-029 grants its printed +50 only for an archived Support', () => {
  const skipped = startArt('hBP07-029', 'AUDIT-DUMMY');
  const base = applyAction(skipped, 0, { type: 'choose', skip: true }, pool, () => 0);
  const supportChoice = startArt('hBP07-029', 'hBP01-102');
  const support = applyAction(supportChoice, 0, { type: 'choose', optionId: 'archive' }, pool, () => 0);
  assert.equal(support.players[1].zones.center.damage - base.players[1].zones.center.damage, 50);
});

test('hBP07-029 sends the archived Holomem branch to the Cheer recipient choice', () => {
  const game = startArt('hBP07-029', 'AUDIT-DUMMY');
  assert.equal(game.pendingChoice?.effect, 'hBP07MioTopArchiveArt');
  game.players[0].cheerDeck = [inst('hY01-001', 'cheer-top')];
  const resolved = applyAction(game, 0, { type: 'choose', optionId: 'archive' }, pool, () => 0);
  assert.equal(resolved.pendingChoice?.type, 'eventCheerTarget');
  assert.deepEqual(resolved.pendingChoice?.options, ['center']);
  const cheerCount = resolved.players[0].zones.center.cheer.length;
  const attached = applyAction(resolved, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(attached.players[0].zones.center.cheer.length, cheerCount + 1);
  assert.ok(attached.players[0].zones.center.cheer.some((entry) => entry.id === 'cheer-top'));
  assert.equal(attached.players[0].cheerDeck.length, 0);
});
