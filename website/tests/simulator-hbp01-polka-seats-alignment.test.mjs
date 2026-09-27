import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, state, unit, inst, attack, fund } from './fixtures/simulator-audit.mjs';

const act = (s, action) => applyAction(structuredClone(s), 0, action, pool, () => 0.5);

function polkaBloom() {
  const s = state('hBP01-068');
  s.phase = 'main';
  s.players[0].zones.center = unit('hBP01-068');
  s.players[0].hand = [inst('hBP01-071', 'polka-bloom')];
  s.players[0].archive = [inst('hBP01-126', 'seat-fan'), inst('AUDIT-DUMMY', 'unrelated-holomem')];
  let next = act(s, { type: 'play', cardId: 'polka-bloom' });
  next = act(next, { type: 'choose', zone: 'center' });
  return next;
}

test('hBP01-071 Bloom retrieves its named Fan from Archive, not a Holomen', () => {
  assert.equal(cards.find((card) => card.number === 'hBP01-126')?.typeCode, 'supportFan');
  const s = polkaBloom();
  assert.equal(s.pendingChoice?.effect, 'archiveToHand');
  assert.equal(s.pendingChoice?.optional, true);
  assert.deepEqual(s.pendingChoice?.cards.map((card) => card.id), ['seat-fan']);
});

test('hBP01-071 Bloom can decline and retains the archived Fan', () => {
  let s = polkaBloom();
  assert.ok(s.pendingChoice, 'the Bloom effect should be queued when its Fan is in Archive');
  s = act(s, { type: 'choose', skip: true });
  assert.equal(s.players[0].archive[0].id, 'seat-fan');
  assert.equal(s.players[0].hand.length, 0);
});

test('hBP01-071 Arts counts Fans attached anywhere on own Stage', () => {
  const card = cards.find((entry) => entry.number === 'hBP01-071');
  const s = state(card.number);
  fund(s.players[0].zones.center, card.arts[0].cost);
  s.players[0].zones.center.attachments = [inst('hBP01-126', 'fan-center')];
  s.players[0].zones.back1 = unit('AUDIT-DUMMY', {
    attachments: [inst('hBP01-126', 'fan-back'), inst('hBP01-116', 'mascot')],
  });
  const end = act(s, attack);
  assert.equal(end.players[1].zones.center.damage, 90);
});
