import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, state, unit, inst } from './fixtures/simulator-audit.mjs';

const act = (s, action) => applyAction(structuredClone(s), 0, action, pool, () => 0.5);
const myth = cards.find(card => card.group === 'holomem' && card.tags?.includes('#Myth'));
const costHolomem = cards.find(card => card.group === 'holomem' && card.number !== 'hBP02-055');

test('hBP02-055 archives an optional hand Holomem before offering its #Myth Arts buff', () => {
  let s = state('hBP02-054');
  s.phase = 'main';
  s.players[0].zones.center = unit(myth.number);
  s.players[0].zones.back1 = unit('hBP02-055');
  s.players[0].hand = [inst(costHolomem.number, 'cost')];

  s = act(s, { type: 'collab', zone: 'back1' });
  assert.equal(s.pendingChoice?.effect, 'genericKeywordHandArchiveCost');
  assert.equal(s.pendingChoice?.optional, true);
  const skipped = act(s, { type: 'choose', skip: true });
  assert.equal(skipped.pendingChoice, null);
  assert.equal(skipped.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 20), false);
  assert.ok(skipped.players[0].hand.some(card => card.id === 'cost'));

  s = act(s, { type: 'choose', cardIds: ['cost'] });
  assert.equal(s.pendingChoice?.type, 'stageTarget');
  assert.deepEqual(s.pendingChoice.options, ['center', 'collab']);
  s = act(s, { type: 'choose', zone: 'center' });
  assert.equal(s.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 20), true);
  assert.ok(s.players[0].archive.some(card => card.id === 'cost'));
});

const holomemPair = (() => {
  const holomen = cards.filter(card => card.group === 'holomem' && card.tags?.length);
  for (let i = 0; i < holomen.length; i += 1) {
    for (let j = i + 1; j < holomen.length; j += 1) {
      if (holomen[i].tags.some(tag => holomen[j].tags.includes(tag))) return holomen.slice(i, j + 1).filter((_, index) => index === 0 || index === j - i);
    }
  }
  throw new Error('Local catalog has no two Holomen with a shared tag');
})();

test('hBP02-057 archives exactly two same-tag Holomen then draws two', () => {
  const s = state('hBP02-054');
  s.phase = 'main';
  s.players[0].hand = [inst('hBP02-057', 'bloom'), ...holomemPair.map((card, index) => inst(card.number, `cost-${index}`))];
  s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'draw-1'), inst('AUDIT-DUMMY', 'draw-2')];

  let next = act(s, { type: 'play', cardId: 'bloom' });
  next = act(next, { type: 'choose', zone: 'center' });
  assert.equal(next.pendingChoice?.effect, 'sameTagHandCost');
  assert.equal(next.pendingChoice?.optional, true);
  assert.throws(() => act(next, { type: 'choose', cardIds: ['cost-0'] }));
  next = act(next, { type: 'choose', cardIds: ['cost-0', 'cost-1'] });
  assert.deepEqual(next.players[0].archive.map(card => card.id), ['cost-0', 'cost-1']);
  assert.deepEqual(next.players[0].hand.map(card => card.id), ['draw-1', 'draw-2']);
});
