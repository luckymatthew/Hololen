import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, isActionCandidateLegal } from '../lib/simulator/engine.mjs';
import { cards, pool, inst, unit, state, fund, attack } from './fixtures/simulator-audit.mjs';

test('hBP08-041 Arts archives exactly the top card and deals its printed damage', () => {
  let s = state('hBP08-041');
  fund(s.players[0].zones.center, ['無色']);
  s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'top'), inst('AUDIT-DUMMY', 'next')];

  s = applyAction(s, 0, attack, pool, () => 0);

  assert.equal(s.players[1].zones.center.damage, 20);
  assert.deepEqual(s.players[0].archive.map(card => card.id), ['top']);
  assert.deepEqual(s.players[0].mainDeck.map(card => card.id), ['next']);
  assert.equal(s.players[0].turnEvents.deckArchived, 1);
});

test('hBP08-042 Bloom effect can archive Holomen and Support cards and scales Arts by cards paid', () => {
  let s = state('hBP01-062');
  s.phase = 'main';
  s.players[0].zones.center = unit('hBP01-062');
  s.players[0].hand = [
    inst('hBP08-042', 'bloom'),
    inst('hBP08-041', 'pay-holomem'),
    inst('hBP01-102', 'pay-support'),
    inst('hBP08-043', 'unused'),
  ];

  s = applyAction(s, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
  assert.equal(s.pendingChoice.type, 'bloom');
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.pendingChoice.effect, 'genericKeywordHandArchiveCost');
  assert.equal(s.pendingChoice.optional, true);
  assert.equal(s.pendingChoice.max, 3);
  s = applyAction(s, 0, { type: 'choose', cardIds: ['pay-holomem', 'pay-support'] }, pool, () => 0);
  assert.equal(s.players[0].archive.some(card => card.id === 'pay-holomem'), true);
  assert.equal(s.players[0].archive.some(card => card.id === 'pay-support'), true);
  assert.equal(s.pendingChoice.effect, 'addModifier');
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.ok(s.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 20 && modifier.sourceNumber === 'hBP08-042'));
});

test('hBP08-043 Collab discount applies at ten archived Holomen and its Arts adds Holo Power for all-Myth stage', () => {
  const purple = cards.find(card => card.group === 'holomem' && card.stage === '2nd' && card.colors?.includes('紫'));
  assert.ok(purple, 'test fixture must include a real Purple 2nd Holomen');
  let s = state('hBP08-041', purple.number);
  s.phase = 'main';
  s.players[0].zones.center = unit('hBP08-041');
  s.players[0].zones.back1 = unit('hBP08-043');
  s.players[0].archive = Array.from({ length: 10 }, (_, index) => inst('AUDIT-DUMMY', `archive-${index}`));
  s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'top')];

  s = applyAction(s, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  s.phase = 'performance';
  const art = { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 };
  assert.equal(isActionCandidateLegal(s, 0, art, pool), true, 'two Red Arts costs are reduced to zero');
  s = applyAction(s, 0, art, pool, () => 0);

  assert.equal(s.players[0].holoPower.length, 1, 'all own stage Holomen are #Myth');
  assert.equal(s.players[1].zones.center.damage, 50, 'this card has 50 printed Arts damage and no target-color bonus');
});

test('hBP08-043 Collab discount is unavailable below ten archived Holomen', () => {
  let s = state('hBP08-043');
  s.phase = 'main';
  s.players[0].zones.back1 = unit('hBP08-043');
  s.players[0].archive = Array.from({ length: 9 }, (_, index) => inst('AUDIT-DUMMY', `archive-${index}`));
  s = applyAction(s, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  s.phase = 'performance';

  assert.equal(isActionCandidateLegal(s, 0, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 }, pool), false);
});

test('hBP08-044 Purple-target bonus and archive Gift perform the printed Arts and Bloom effects', () => {
  const purple = cards.find(card => card.group === 'holomem' && card.stage === '2nd' && card.colors?.includes('紫'));
  assert.ok(purple, 'test fixture must include a real Purple 2nd Holomen');
  let s = state('hBP08-044', purple.number);
  fund(s.players[0].zones.center, ['紅', '紅']);
  s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'top'), inst('AUDIT-DUMMY', 'next')];
  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.pendingChoice.effect, 'artDeckTopArchive');
  s = applyAction(s, 0, { type: 'choose', optionId: '1' }, pool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 150, '100 printed Arts damage plus 50 against Purple');

  s = state('hBP08-042');
  s.phase = 'main';
  s.players[0].zones.center = unit('hBP08-042');
  s.players[0].archive = [inst('hBP08-044', 'archived-kiara'), ...Array.from({ length: 9 }, (_, index) => inst('AUDIT-DUMMY', `archive-${index}`))];
  assert.equal(isActionCandidateLegal(s, 0, { type: 'giftSkill', cardNumber: 'hBP08-044' }, pool), true);
  s = applyAction(s, 0, { type: 'giftSkill', cardNumber: 'hBP08-044' }, pool, () => 0);
  assert.equal(s.pendingChoice.effect, 'giftArchiveBloomCard');
  s = applyAction(s, 0, { type: 'choose', cardIds: ['archived-kiara'] }, pool, () => 0);
  assert.equal(s.pendingChoice.effect, 'giftArchiveBloom');
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.players[0].zones.center.stack.at(-1).number, 'hBP08-044');
  assert.equal(s.players[0].archive.some(card => card.id === 'archived-kiara'), false);
});

test('hBP08-045 Bae Collab doubles its own Arts die and applies its Green-target bonus', () => {
  let s = state('AUDIT-DUMMY', 'hBP01-034');
  s.phase = 'main';
  s.players[0].zones.back1 = unit('hBP08-045');
  fund(s.players[0].zones.back1, ['紅']);

  s = applyAction(s, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  s.phase = 'performance';
  assert.ok(s.players[0].modifiers.some(modifier => modifier.kind === 'baeDieMultiplier' && modifier.amount === 2));
  s = applyAction(s, 0, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 }, pool, () => 0);
  assert.equal(s.pendingChoice.effect, 'artBuffTarget');
  assert.equal(s.pendingChoice.meta.amount, 20, 'the raw die result of one is counted as two');
  s = applyAction(s, 0, { type: 'choose', zone: 'collab' }, pool, () => 0);

  assert.equal(s.players[1].zones.center.damage, 120, '50 printed damage + 50 against Green + 20 doubled die bonus to Bae');
});

test('hBP08-047 first-turn draw is suppressed for the first player and after the first turn', () => {
  for (const config of [
    { firstPlayer: 0, playerIndex: 0, turnsTaken: 1 },
    { firstPlayer: 0, playerIndex: 1, turnsTaken: 2 },
  ]) {
    let s = state();
    s.phase = 'main';
    s.firstPlayer = config.firstPlayer;
    s.activePlayer = config.playerIndex;
    s.players[config.playerIndex].turnsTaken = config.turnsTaken;
    s.players[config.playerIndex].zones.back1 = unit('hBP08-047');
    const before = s.players[config.playerIndex].hand.length;
    s = applyAction(s, config.playerIndex, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(s.players[config.playerIndex].hand.length, before);
  }
});

for (const [number, color, damage] of [
  ['hBP08-042', '紅', 40],
  ['hBP08-046', '紅', 30],
  ['hBP08-047', '藍', 30],
  ['hBP08-048', '無色', 30],
]) {
  test(`${number} base Arts damage is ${damage}`, () => {
    let s = state(number);
    fund(s.players[0].zones.center, [color]);
    s = applyAction(s, 0, attack, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, damage);
  });
}
