import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, state, inst, unit, dummy } from './fixtures/simulator-audit.mjs';

const act = (current, action) => applyAction(structuredClone(current), 0, action, pool, () => .5);
const kiaraDebut = cards.find(card => card.group === 'holomem' && card.stage === 'Debut' && card.jpName === '小鳥遊キアラ');
const id2Holomem = cards.find(card => card.group === 'holomem' && card.tags?.includes('#ID2期生'));
assert.ok(kiaraDebut, 'fixture catalog needs a Debut Kiara');
assert.ok(id2Holomem, 'fixture catalog needs an #ID2期生 Holomem');

test('hBP01-125 KFP triggers only from hand and the paid option archives then draws', () => {
  const current = state(kiaraDebut.number);
  current.phase = 'main';
  current.players[0].hand = [inst('hBP01-125', 'fan'), inst(dummy.number, 'discard')];
  current.players[0].mainDeck = [inst(dummy.number, 'draw')];
  let next = act(current, { type: 'play', cardId: 'fan' });
  assert.equal(next.pendingChoice?.type, 'attachSupport');
  next = act(next, { type: 'choose', zone: 'center' });
  assert.equal(next.pendingChoice?.effect, 'kfpDiscard');
  assert.equal(next.pendingChoice?.optional, true);
  next = act(next, { type: 'choose', cardIds: ['discard'] });
  assert.equal(next.players[0].archive.at(-1)?.id, 'discard');
  assert.equal(next.players[0].hand.at(-1)?.id, 'draw');
  assert.ok(next.players[0].zones.center.attachments.some(card => card.number === 'hBP01-125'));
});

test('hBP02-002 normal skill removes one green Cheer and makes its Cheer-deck attachment optional', () => {
  const current = state();
  current.phase = 'main';
  current.players[0].oshi = inst('hBP02-002');
  current.players[0].holoPower = [inst(dummy.number, 'power-1'), inst(dummy.number, 'power-2')];
  current.players[0].archive = [inst('hY02-001', 'green-cheer')];
  current.players[0].cheerDeck = [inst('hY03-001', 'top-cheer'), inst('hY04-001', 'next-cheer')];
  let next = act(current, { type: 'oshiSkill' });
  assert.equal(next.pendingChoice?.effect, 'oshiRemoveArchivedCheer');
  assert.equal(next.pendingChoice?.optional, false);
  assert.throws(() => act(next, { type: 'choose', skip: true }));
  next = act(next, { type: 'choose', cardIds: ['green-cheer'] });
  assert.equal(next.players[0].removed.at(-1)?.id, 'green-cheer');
  assert.equal(next.pendingChoice?.effect, 'oshiCheerDeckPick');
  assert.equal(next.pendingChoice?.optional, true);
  next = act(next, { type: 'choose', skip: true });
  assert.equal(next.pendingChoice, null);
  assert.equal(next.players[0].cheerDeck.length, 2);
});

test('hBP02-002 SP counts distinct attached Cheer colors for each #ID2期生 Holomem', () => {
  const current = state(id2Holomem.number);
  current.phase = 'main';
  current.players[0].oshi = inst('hBP02-002');
  current.players[0].holoPower = [inst(dummy.number, 'sp-1'), inst(dummy.number, 'sp-2')];
  current.players[0].zones.center = unit(id2Holomem.number, { cheer: [inst('hY02-001', 'green-a'), inst('hY02-001', 'green-b'), inst('hY03-001', 'red')] });
  current.players[0].zones.back1 = unit(id2Holomem.number, { cheer: [inst('hY04-001', 'blue')] });
  const next = act(current, { type: 'spOshiSkill' });
  const centerBonus = next.players[0].zones.center.modifiers.find(modifier => modifier.sourceNumber === 'hBP02-002' && modifier.kind === 'arts');
  const backBonus = next.players[0].zones.back1.modifiers.find(modifier => modifier.sourceNumber === 'hBP02-002' && modifier.kind === 'arts');
  assert.equal(centerBonus?.amount, 40);
  assert.equal(backBonus?.amount, 20);
});
