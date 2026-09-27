import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, inst, unit, state, attack, pool, fund } from './fixtures/simulator-audit.mjs';

test('hBP08-065 Arts gains 30 only while own hand is at most two cards', () => {
  for (const handCount of [2, 3]) {
    let s = state('hBP08-065');
    fund(s.players[0].zones.center, ['紫', '紫']);
    s.players[0].hand = Array.from({ length: handCount }, (_, index) => inst('AUDIT-DUMMY', `hand-${index}`));
    s = applyAction(s, 0, attack, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, handCount <= 2 ? 80 : 50);
  }
});

test('hBP08-065 center Bloom rolls one die and draws three only on one', () => {
  for (const [roll, drawCount] of [[0, 3], [0.5, 1]]) {
    let s = state('hBP08-061');
    s.phase = 'main';
    s.players[0].hand = [inst('hBP08-065', 'lui-bloom'), inst('AUDIT-DUMMY', 'lui-cost')];
    s.players[0].mainDeck = Array.from({ length: 4 }, (_, index) => inst('AUDIT-DUMMY', `deck-${index}`));

    s = applyAction(s, 0, { type: 'play', cardId: 'lui-bloom' }, pool, () => roll);
    s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => roll);
    assert.equal(s.pendingChoice?.effect, 'genericKeywordHandArchiveCost');
    s = applyAction(s, 0, { type: 'choose', cardIds: ['lui-cost'] }, pool, () => roll);

    assert.equal(s.players[0].hand.length, drawCount);
    assert.equal(s.players[0].mainDeck.length, 4 - drawCount);
    assert.equal(s.players[0].archive.some(card => card.id === 'lui-cost'), true);
  }
});

test('hBP08-065 optional hand archive can be declined without rolling or drawing', () => {
  let s = state('hBP08-061');
  s.phase = 'main';
  s.players[0].hand = [inst('hBP08-065', 'lui-bloom'), inst('AUDIT-DUMMY', 'lui-cost')];
  s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'deck-0'), inst('AUDIT-DUMMY', 'deck-1')];

  const unexpectedRoll = () => { throw new Error('declining hBP08-065 must not roll'); };
  s = applyAction(s, 0, { type: 'play', cardId: 'lui-bloom' }, pool, unexpectedRoll);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, unexpectedRoll);
  assert.equal(s.pendingChoice?.optional, true);
  s = applyAction(s, 0, { type: 'choose', skip: true }, pool, unexpectedRoll);

  assert.equal(s.players[0].hand.length, 1);
  assert.equal(s.players[0].archive.length, 0);
  assert.equal(s.players[0].mainDeck.length, 2);
  assert.equal(s.pendingChoice, null);
});

test('hBP08-065 Bloom-only-Center effect does not resolve in Back', () => {
  let s = state('hBP08-068');
  s.phase = 'main';
  s.players[0].zones.back1 = unit('hBP08-061');
  s.players[0].hand = [inst('hBP08-065', 'lui-bloom')];
  s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'deck-0'), inst('AUDIT-DUMMY', 'deck-1'), inst('AUDIT-DUMMY', 'deck-2')];

  s = applyAction(s, 0, { type: 'play', cardId: 'lui-bloom' }, pool, () => 0);
  s = applyAction(s, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);

  assert.equal(s.pendingChoice, null);
  assert.equal(s.players[0].hand.length, 0);
  assert.equal(s.players[0].mainDeck.length, 3);
});

test('hBP08-066 Arts archives one or two selected hand cards and adds 20 per card', () => {
  let s = state('hBP08-066');
  fund(s.players[0].zones.center, ['無色']);
  s.players[0].hand = [inst('AUDIT-DUMMY', 'cost-1'), inst('AUDIT-DUMMY', 'cost-2'), inst('AUDIT-DUMMY', 'keep')];

  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.pendingChoice?.effect, 'artHandArchiveCost');
  assert.equal(s.pendingChoice.optional, true);
  assert.equal(s.pendingChoice.min, 1);
  assert.equal(s.pendingChoice.max, 2);
  s = applyAction(s, 0, { type: 'choose', cardIds: ['cost-1', 'cost-2'] }, pool, () => 0);

  assert.deepEqual(s.players[0].archive.map(card => card.id), ['cost-1', 'cost-2']);
  assert.deepEqual(s.players[0].hand.map(card => card.id), ['keep']);
  assert.equal(s.players[1].zones.center.damage, 100);
});

test('hBP08-067 Arts uses the zero-card +70 branch instead of +50', () => {
  for (const [handCount, damage] of [[0, 200], [1, 180], [2, 180], [3, 130]]) {
    let s = state('hBP08-067');
    fund(s.players[0].zones.center, ['紫', '紫', '紫']);
    s.players[0].hand = Array.from({ length: handCount }, (_, index) => inst('AUDIT-DUMMY', `hand-${index}`));
    s = applyAction(s, 0, attack, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, damage);
  }

  const greenTargetCard = { ...pool.find(card => card.number === 'AUDIT-DUMMY'), number: 'AUDIT-GREEN', colors: ['綠'] };
  let greenTarget = state('hBP08-067', greenTargetCard.number);
  fund(greenTarget.players[0].zones.center, ['紫', '紫', '紫']);
  greenTarget = applyAction(greenTarget, 0, attack, [...pool, greenTargetCard], () => 0);
  assert.equal(greenTarget.players[1].zones.center.damage, 250);
});

test('hBP08-067 Center-only Bloom cost does not resolve when Blooming in Back', () => {
  let s = state('hBP08-068');
  s.phase = 'main';
  s.players[0].zones.back1 = unit('hBP08-066');
  s.players[0].hand = [inst('hBP08-067', 'lui-bloom'), inst('AUDIT-DUMMY', 'pay-1'), inst('AUDIT-DUMMY', 'pay-2')];
  s.players[1].zones.center = unit('hBP08-065');

  s = applyAction(s, 0, { type: 'play', cardId: 'lui-bloom' }, pool, () => 0);
  s = applyAction(s, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);

  assert.equal(s.pendingChoice, null);
  assert.deepEqual(s.players[0].hand.map(card => card.id), ['pay-1', 'pay-2']);
});

test('hBP08-068 first-turn second-player Collab marks every opposing Holomen as all-colors', () => {
  let s = state();
  s.phase = 'main';
  s.firstPlayer = 0;
  s.activePlayer = 1;
  s.players[1].turnsTaken = 1;
  s.players[1].zones.back1 = unit('hBP08-068');
  s.players[0].zones.center = unit('hBP08-065');
  s.players[0].zones.back1 = unit('hBP08-066');
  s.players[0].zones.back2 = unit('hBP08-067');

  s = applyAction(s, 1, { type: 'collab', zone: 'back1' }, pool, () => 0);

  for (const zone of ['center', 'back1', 'back2']) {
    assert.ok(s.players[0].zones[zone].modifiers.some(modifier => modifier.kind === 'allColors'));
  }

  s = state();
  s.phase = 'main';
  s.firstPlayer = 0;
  s.activePlayer = 1;
  s.players[1].turnsTaken = 2;
  s.players[1].zones.back1 = unit('hBP08-068');
  s.players[0].zones.center = unit('hBP08-065');
  s = applyAction(s, 1, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.equal(s.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'allColors'), false);
});

test('hBP08-069 Collab draws one only at three own #絵 Holomen', () => {
  for (const partnerCount of [2, 3]) {
    let s = state('hBP08-068');
    s.phase = 'main';
    s.players[0].zones.back1 = unit('hBP08-069');
    s.players[0].zones.back2 = partnerCount === 3 ? unit('hBP08-070') : null;
    // Collab moves the deck's top card to Holo Power before resolving its text.
    s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'collab-power'), inst('AUDIT-DUMMY', 'draw')];

    s = applyAction(s, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);

    assert.equal(s.players[0].hand.some(card => card.id === 'draw'), partnerCount === 3);
    assert.equal(s.players[0].holoPower.some(card => card.id === 'collab-power'), true);
  }
});

test('hBP08-069 unmodified Arts uses its printed colorless cost and 30 damage', () => {
  let s = state('hBP08-069');
  fund(s.players[0].zones.center, ['無色']);
  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 30);
});

test('hBP08-070 Arts heals each own damaged Myth by 10 per color-mismatched opposing Holomen', () => {
  const blueOshi = cards.find(card => card.group === 'oshi' && card.colors?.length === 1 && card.colors.includes('藍'));
  const redOshi = cards.find(card => card.group === 'oshi' && card.colors?.length === 1 && card.colors.includes('紅'));
  const redHolomen = cards.find(card => card.group === 'holomem' && card.stage === 'Debut' && card.colors?.length === 1 && card.colors.includes('紅'));
  assert.ok(blueOshi && redOshi && redHolomen, 'the existing catalogue contains single-color Blue and Red cards');
  for (const [opponentOshi, expectedDamage] of [[redOshi, 50], [blueOshi, 30]]) {
    let s = state('hBP08-070');
    fund(s.players[0].zones.center, ['紫']);
    s.players[0].zones.center.damage = 50;
    s.players[0].zones.back1 = unit('hBP08-071', { damage: 50 });
    s.players[1].zones.center = unit(redHolomen.number, { stack: [inst(redHolomen.number, 'opp-red-center')] });
    s.players[1].zones.collab = unit(redHolomen.number, { stack: [inst(redHolomen.number, 'opp-red-collab')] });
    s.players[1].oshi = inst(opponentOshi.number);

    s = applyAction(s, 0, attack, pool, () => 0);

    assert.equal(s.players[0].zones.center.damage, expectedDamage);
    assert.equal(s.players[0].zones.back1.damage, expectedDamage);
  }
});

test('hBP08-071 Bloom special damage excludes targets sharing the opposing Oshi color', () => {
  const blueOshi = cards.find(card => card.group === 'oshi' && card.colors?.length === 1 && card.colors.includes('藍'));
  const blueHolomen = cards.find(card => card.group === 'holomem' && card.stage === 'Debut' && card.colors?.length === 1 && card.colors.includes('藍'));
  const redHolomen = cards.find(card => card.group === 'holomem' && card.stage === 'Debut' && card.colors?.length === 1 && card.colors.includes('紅'));
  assert.ok(blueOshi && blueHolomen && redHolomen);
  let s = state('hBP08-068');
  s.phase = 'main';
  s.players[0].hand = [inst('hBP08-071', 'ina-bloom')];
  s.players[1].oshi = inst(blueOshi.number);
  s.players[1].zones.center = unit(redHolomen.number);
  s.players[1].zones.collab = unit(blueHolomen.number);

  s = applyAction(s, 0, { type: 'play', cardId: 'ina-bloom' }, pool, () => 0);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);

  assert.equal(s.pendingChoice?.effect, 'specialDamage');
  assert.deepEqual(s.pendingChoice.options, ['center']);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 20);
  assert.equal(s.players[1].zones.collab.damage, 0);
});

test('hBP08-071 unmodified Arts uses its printed two-Colorless cost and 50 damage', () => {
  let s = state('hBP08-071');
  fund(s.players[0].zones.center, ['無色', '無色']);
  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 50);
});

test('hBP08-072 Arts gains ten per color-mismatched opposing Holomen', () => {
  const blueOshi = cards.find(card => card.group === 'oshi' && card.colors?.length === 1 && card.colors.includes('藍'));
  const blueHolomen = cards.find(card => card.group === 'holomem' && card.stage === 'Debut' && card.colors?.length === 1 && card.colors.includes('藍'));
  const redHolomen = cards.find(card => card.group === 'holomem' && card.stage === 'Debut' && card.colors?.length === 1 && card.colors.includes('紅'));
  assert.ok(blueOshi && blueHolomen && redHolomen);
  let s = state('hBP08-072');
  fund(s.players[0].zones.center, ['紫']);
  s.players[1].oshi = inst(blueOshi.number);
  s.players[1].zones.center = unit(redHolomen.number);
  s.players[1].zones.collab = unit(blueHolomen.number);
  s.players[1].zones.back1 = unit(redHolomen.number);

  s = applyAction(s, 0, attack, pool, () => 0);

  assert.equal(s.players[1].zones.center.damage, 50);
});

test('hBP08-072 Bloom recovers an archived Myth only at eight and uses once per turn', () => {
  let s = state('hBP08-070');
  s.phase = 'main';
  s.players[0].hand = [inst('hBP08-072', 'ina-bloom')];
  s.players[0].archive = Array.from({ length: 8 }, (_, index) => inst('hBP08-068', `myth-${index}`));

  s = applyAction(s, 0, { type: 'play', cardId: 'ina-bloom' }, pool, () => 0);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.pendingChoice?.effect, 'archiveToHand');
  assert.equal(s.pendingChoice.optional, true);
  s = applyAction(s, 0, { type: 'choose', cardIds: ['myth-0'] }, pool, () => 0);
  assert.ok(s.players[0].hand.some(card => card.id === 'myth-0'));
  assert.equal(s.players[0].archive.length, 7);
  assert.equal(s.players[0].namedUsageTurns['bloom:hBP08-072'], s.turn);

  s = state('hBP08-070');
  s.phase = 'main';
  s.players[0].hand = [inst('hBP08-072', 'ina-bloom')];
  s.players[0].archive = Array.from({ length: 7 }, (_, index) => inst('hBP08-068', `myth-${index}`));
  s = applyAction(s, 0, { type: 'play', cardId: 'ina-bloom' }, pool, () => 0);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.pendingChoice, null);
});
