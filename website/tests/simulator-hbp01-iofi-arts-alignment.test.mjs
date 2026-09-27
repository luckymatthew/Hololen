import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, state, unit, inst, attack, fund } from './fixtures/simulator-audit.mjs';

const act = (s, action) => applyAction(structuredClone(s), 0, action, pool, () => 0.5);

function start() {
  const source = cards.find((card) => card.number === 'hBP01-052');
  const recipient = cards.find((card) => card.number === 'hBP01-055');
  assert.ok(source?.arts?.[0]?.effect.includes('#ID'));
  assert.ok(recipient?.tags?.includes('#ID'));

  const s = state(source.number);
  fund(s.players[0].zones.center, source.arts[0].cost);
  s.players[0].zones.center.cheer.push(inst('hY02-001', 'movable-cheer'));
  s.players[0].zones.back1 = unit(recipient.number);
  s.players[0].zones.back2 = unit('hBP01-056');
  return act(s, attack);
}

test('hBP01-052 Arts offers optional Stage Cheer transfer to an #ID Holomen', () => {
  const s = start();
  assert.equal(s.pendingChoice?.effect, 'genericMoveCheer');
  assert.equal(s.pendingChoice?.optional, true);
  assert.deepEqual(s.pendingChoice.cheerOptions.map((option) => option.id), ['cheer0', 'movable-cheer']);
});

test('hBP01-052 Arts transfer filters recipients to #ID and preserves a decline', () => {
  let s = start();
  s = act(s, { type: 'choose', zone: 'center', cheerId: 'movable-cheer' });
  assert.deepEqual(s.pendingChoice.options, ['center', 'back1']);
  assert.throws(() => act(s, { type: 'choose', zone: 'back2' }));
  s = act(s, { type: 'choose', zone: 'back1' });
  assert.ok(s.players[0].zones.back1.cheer.some((cheer) => cheer.id === 'movable-cheer'));
  assert.ok(!s.players[0].zones.center.cheer.some((cheer) => cheer.id === 'movable-cheer'));

  let declined = start();
  declined = act(declined, { type: 'choose', skip: true });
  assert.ok(declined.players[0].zones.center.cheer.some((cheer) => cheer.id === 'movable-cheer'));
  assert.equal(declined.pendingChoice, null);
});

test('hBP01-057 Collab and Arts both route 10 special damage to opponent Collab', () => {
  let s = state('hBP01-057');
  s.phase = 'main';
  s.players[0].zones.back1 = unit('hBP01-057');
  s.players[1].zones.collab = unit('AUDIT-DUMMY');
  s = act(s, { type: 'collab', zone: 'back1' });
  assert.equal(s.players[1].zones.collab.damage, 10);
  assert.equal(s.players[1].zones.center.damage, 0);

  s = state('hBP01-057');
  fund(s.players[0].zones.center, cards.find((card) => card.number === 'hBP01-057').arts[0].cost);
  s.players[1].zones.collab = unit('AUDIT-DUMMY');
  s = act(s, attack);
  assert.equal(s.players[1].zones.center.damage, 20);
  assert.equal(s.players[1].zones.collab.damage, 10);
});

test('hBP01-062 Arts archive is optional and adds 20 only when paid', () => {
  const startKiara = () => {
    const card = cards.find((entry) => entry.number === 'hBP01-062');
    const s = state(card.number);
    fund(s.players[0].zones.center, card.arts[0].cost);
    s.players[0].hand = [inst('AUDIT-DUMMY', 'kiara-cost')];
    return act(s, attack);
  };

  let s = startKiara();
  assert.equal(s.pendingChoice?.optional, true);
  s = act(s, { type: 'choose', skip: true });
  assert.equal(s.players[0].archive.length, 0);
  assert.equal(s.players[1].zones.center.damage, 20);

  s = startKiara();
  s = act(s, { type: 'choose', cardIds: ['kiara-cost'] });
  assert.equal(s.players[0].archive[0].id, 'kiara-cost');
  assert.equal(s.players[1].zones.center.damage, 40);
});
