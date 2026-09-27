import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { pool, inst, state, attack, fund } from './fixtures/simulator-audit.mjs';

test('hBP05-069 Arts attaches the Cheer deck top to itself, without searching', () => {
  let s = state('hBP05-069');
  fund(s.players[0].zones.center, ['無色', '無色']);
  s.players[0].cheerDeck = [inst('hY01-001', 'cheerTop'), inst('hY02-001', 'cheerSecond')];

  s = applyAction(s, 0, attack, pool, () => 0);

  assert.equal(s.pendingChoice?.type, 'eventCheerTarget');
  assert.equal(s.pendingChoice?.optional, true);
  assert.deepEqual(s.pendingChoice?.options, ['center']);
  assert.equal(s.pendingChoice?.cardNumber, 'hY01-001');
  assert.deepEqual(s.players[0].cheerDeck.map(card => card.id), ['cheerTop', 'cheerSecond']);

  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);

  assert.deepEqual(s.players[0].zones.center.cheer.map(card => card.id), ['cheer0', 'cheer1', 'cheerTop']);
  assert.deepEqual(s.players[0].cheerDeck.map(card => card.id), ['cheerSecond']);
  assert.equal(s.pendingChoice, null);
});

test('hBP05-069 may decline its top Cheer attachment', () => {
  let s = state('hBP05-069');
  fund(s.players[0].zones.center, ['無色', '無色']);
  s.players[0].cheerDeck = [inst('hY01-001', 'cheerTop')];

  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.pendingChoice?.type, 'eventCheerTarget');
  s = applyAction(s, 0, { type: 'choose', skip: true }, pool, () => 0);

  assert.equal(s.players[0].zones.center.cheer.length, 2);
  assert.deepEqual(s.players[0].cheerDeck.map(card => card.id), ['cheerTop']);
  assert.equal(s.pendingChoice, null);
});
