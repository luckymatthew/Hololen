import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, state, unit, inst, fund, attack } from './fixtures/simulator-audit.mjs';

const limitedEvent = cards.find(card => card.group === 'support' && card.typeCode === 'supportEventLimited');
const limitedItem = cards.find(card => card.group === 'support' && String(card.type || '').toUpperCase().includes('LIMITED') && card.typeCode !== 'supportEventLimited');
const normalEvent = cards.find(card => card.group === 'support' && card.typeCode === 'supportEvent');
const secondHolomen = cards.find(card => card.group === 'holomem' && card.stage === '2nd');
const firstHolomen = cards.find(card => card.group === 'holomem' && card.stage === '1st');

for (const [label, support, target, expected] of [
  ['LIMITED Event against a 2nd', limitedEvent, secondHolomen, 120],
  ['LIMITED Item against a 2nd', limitedItem, secondHolomen, 50],
  ['ordinary Event against a 2nd', normalEvent, secondHolomen, 50],
  ['LIMITED Event against a 1st', limitedEvent, firstHolomen, 50],
]) {
  test(`hBP06-076 Arts +70 gate: ${label}`, () => {
    assert.ok(support, `fixture catalog has ${label} support`);
    assert.ok(target, `fixture catalog has ${label} target`);

    const game = state('hBP06-076');
    fund(game.players[0].zones.center, ['黃', '無色']);
    game.players[0].turnEvents = { turn: game.turn, supports: [support.number], arts: [] };
    game.players[1].zones.center = unit(target.number);

    const resolved = applyAction(game, 0, { ...attack, targetZone: 'center' }, pool, () => 0);

    assert.equal(resolved.players[1].zones.center.damage, expected);
  });
}
