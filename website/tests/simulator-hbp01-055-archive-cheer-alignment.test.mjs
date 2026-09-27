import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, state, unit, inst } from './fixtures/simulator-audit.mjs';

const act = (s, action) => applyAction(structuredClone(s), 0, action, pool, () => 0.5);

function collabWithIdRecipients() {
  const s = state('hBP01-055');
  s.phase = 'main';
  s.players[0].zones.center = unit('hBP01-053');
  s.players[0].zones.back1 = unit('hBP01-055');
  s.players[0].zones.back2 = unit('hBP01-054');
  s.players[0].zones.back3 = unit('hBP01-046');
  s.players[0].zones.back4 = unit('AUDIT-DUMMY');
  s.players[0].archive = ['archive-a', 'archive-b', 'archive-c'].map((id) => inst('hY02-001', id));
  return act(s, { type: 'collab', zone: 'back1' });
}

function azkiBloomCheerMove() {
  const debut = cards.find((card) => card.jpName === 'AZKi' && card.stage === 'Debut');
  assert.ok(debut, 'the local catalog should contain AZKi Debut');
  const s = state(debut.number);
  s.phase = 'main';
  s.players[0].zones.back1 = unit('hBP01-047', {
    cheer: [inst('hY02-001', 'stage-cheer-a'), inst('hY02-001', 'stage-cheer-b')],
  });
  s.players[0].zones.back2 = unit('hBP01-047', {
    cheer: [inst('hY02-001', 'stage-cheer-c')],
  });
  s.players[0].hand = [inst('hBP01-046', 'azki-bloom')];
  let next = act(s, { type: 'play', cardId: 'azki-bloom' });
  next = act(next, { type: 'choose', zone: 'center' });
  return next;
}

test('hBP01-046 Bloom can move a chosen Cheer from any own Stage Holomen', () => {
  let s = azkiBloomCheerMove();
  assert.equal(s.pendingChoice?.effect, 'genericMoveCheer');
  assert.equal(s.pendingChoice?.optional, true);
  assert.deepEqual(s.pendingChoice.cheerOptions.map((option) => option.id), [
    'stage-cheer-a', 'stage-cheer-b', 'stage-cheer-c',
  ]);
  s = act(s, { type: 'choose', cheerId: 'stage-cheer-c' });
  assert.deepEqual(s.pendingChoice?.options, ['center', 'back1', 'back2']);
  s = act(s, { type: 'choose', zone: 'center' });
  assert.ok(s.players[0].zones.center.cheer.some((cheer) => cheer.id === 'stage-cheer-c'));
  assert.ok(!s.players[0].zones.back2.cheer.some((cheer) => cheer.id === 'stage-cheer-c'));
});

test('hBP01-046 Bloom may decline without changing Stage Cheer', () => {
  const s = azkiBloomCheerMove();
  const end = act(s, { type: 'choose', skip: true });
  assert.equal(end.players[0].zones.back1.cheer.length, 2);
  assert.equal(end.players[0].zones.back2.cheer.length, 1);
  assert.equal(end.pendingChoice, null);
});

test('hBP01-055 queues an optional 1-3 Archive Cheer transfer for #ID Holomen', () => {
  const s = collabWithIdRecipients();
  assert.equal(s.pendingChoice?.type, 'cardSelection');
  assert.equal(s.pendingChoice?.effect, 'archiveCheerToStage');
  assert.equal(s.pendingChoice?.optional, true);
  assert.equal(s.pendingChoice?.min, 0);
  assert.equal(s.pendingChoice?.max, 3);
  assert.deepEqual(s.pendingChoice?.cards.map((card) => card.id), ['archive-a', 'archive-b', 'archive-c']);
});

test('hBP01-055 attaches at most one selected Cheer to each distinct #ID Holomen', () => {
  let s = collabWithIdRecipients();
  assert.ok(s.pendingChoice, 'the Collab ability should be queued');
  s = act(s, { type: 'choose', cardIds: ['archive-a', 'archive-b', 'archive-c'] });
  assert.deepEqual(s.pendingChoice.options, ['center', 'collab', 'back2']);
  assert.ok(!s.pendingChoice.options.includes('back4'));

  s = act(s, { type: 'choose', zone: 'center' });
  assert.deepEqual(s.pendingChoice.options, ['collab', 'back2']);
  s = act(s, { type: 'choose', zone: 'collab' });
  assert.deepEqual(s.pendingChoice.options, ['back2']);
  s = act(s, { type: 'choose', zone: 'back2' });

  assert.equal(s.players[0].archive.length, 0);
  assert.equal(s.players[0].zones.center.cheer.length, 1);
  assert.equal(s.players[0].zones.collab.cheer.length, 1);
  assert.equal(s.players[0].zones.back2.cheer.length, 1);
  assert.equal(s.players[0].zones.back3.cheer.length, 0);
  assert.equal(s.players[0].zones.back4.cheer.length, 0);
});

test('hBP01-055 permits declining the optional transfer', () => {
  let s = collabWithIdRecipients();
  if (!s.pendingChoice) {
    assert.fail('the Collab ability should be queued before the optional decline');
  }
  s = act(s, { type: 'choose', skip: true });
  assert.equal(s.players[0].archive.length, 3);
  assert.equal(s.pendingChoice, null);
});
