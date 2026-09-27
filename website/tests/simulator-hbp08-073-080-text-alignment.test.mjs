import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, dummy, inst, unit, state, fund, attack } from './fixtures/simulator-audit.mjs';

const holomem = (predicate) => cards.find(card => card.group === 'holomem' && predicate(card));

for (const [number, cost, damage] of [
  ['hBP08-073', ['無色', '無色'], 90],
  ['hBP08-077', ['無色'], 20],
  ['hBP08-078', ['無色'], 20],
  ['hBP08-080', ['無色'], 20],
]) test(`${number} basic Arts uses its printed cost and damage`, () => {
  let s = state(number);
  fund(s.players[0].zones.center, cost);
  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.players[1].zones.center.damage, damage);
});

test('hBP08-073 Arts adds its printed 50 when the opposing target is Blue', () => {
  const blueTarget = { ...dummy, number: 'AUDIT-BLUE', colors: ['藍'] };
  let s = state('hBP08-073');
  fund(s.players[0].zones.center, ['無色', '無色']);
  s.players[1].zones.center = unit(blueTarget.number);
  s = applyAction(s, 0, attack, [...pool, blueTarget], () => 0);
  assert.equal(s.players[1].zones.center.damage, 140);
});

test('hBP08-073 Collab applies all-colors to two distinct opposing Holomen for this turn', () => {
  let s = state();
  s.phase = 'main';
  s.players[0].zones.back1 = unit('hBP08-073');
  s.players[1].zones.center = unit('hBP08-073');
  s.players[1].zones.back1 = unit('hBP08-074');
  s.players[1].zones.back2 = unit('hBP08-075');

  s = applyAction(s, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.equal(s.pendingChoice?.effect, 'allColorsFirst');
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.players[1].zones.center.modifiers.some(modifier => modifier.kind === 'allColors'), true);
  assert.equal(s.pendingChoice?.effect, 'allColorsSecond');
  assert.equal(s.pendingChoice.options.includes('center'), false);
  s = applyAction(s, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
  assert.equal(s.players[1].zones.back1.modifiers.some(modifier => modifier.kind === 'allColors'), true);
  assert.equal(s.players[1].zones.back2.modifiers.some(modifier => modifier.kind === 'allColors'), false);
});

test('hBP08-074 Arts cannot archive more hand cards than there are opposing Holomen to select', () => {
  const yellowTarget = { ...dummy, number: 'AUDIT-074-YELLOW', colors: ['黃'] };
  let s = state('hBP08-074');
  fund(s.players[0].zones.center, ['無色', '無色', '無色']);
  const costs = cards.filter(card => card.group === 'holomem' && card.number !== 'hBP08-074').slice(0, 3);
  assert.equal(costs.length, 3);
  s.players[0].hand = costs.map((card, index) => inst(card.number, `cost-${index}`));
  s.players[1].zones.center = unit(yellowTarget.number);
  s.players[1].zones.back1 = unit('hBP08-075');
  const testPool = [...pool, yellowTarget];

  s = applyAction(s, 0, attack, testPool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 0, 'the optional paid effect resolves before Arts damage');
  assert.equal(s.pendingChoice?.effect, 'genericKeywordHandArchiveCost');
  assert.equal(s.pendingChoice.optional, true);
  assert.equal(s.pendingChoice.min, 1);
  assert.equal(s.pendingChoice.max, 2);

  s = applyAction(s, 0, { type: 'choose', cardIds: ['cost-0', 'cost-1'] }, testPool, () => 0);
  assert.equal(s.players[0].archive.filter(card => ['cost-0', 'cost-1'].includes(card.id)).length, 2);
  for (const zone of ['center', 'back1']) {
    assert.equal(s.pendingChoice?.effect, 'addModifier');
    assert.equal(s.pendingChoice.meta?.kind, 'allColors');
    s = applyAction(s, 0, { type: 'choose', zone }, testPool, () => 0);
    assert.equal(s.players[1].zones[zone].modifiers.some(modifier => modifier.kind === 'allColors'), true);
  }
  assert.equal(s.pendingChoice, null);
  assert.equal(s.players[1].zones.center.damage, 160);
});

test('hBP08-075 Arts adds 20 per Robosa, applies each Fan\'s own -10, and does not run its Bloom search', () => {
  const robosa = cards.find(card => card.jpName === 'ろぼさー' || card.name === 'ろぼさー');
  assert.ok(robosa);
  const yellowTarget = { ...dummy, number: 'AUDIT-YELLOW', colors: ['黃'] };
  let s = state('hBP08-075');
  fund(s.players[0].zones.center, ['紫', '紫']);
  s.players[0].zones.center.attachments = [inst(robosa.number, 'fan-1'), inst(robosa.number, 'fan-2')];
  s.players[1].zones.center = unit(yellowTarget.number);
  s.players[0].mainDeck = Array.from({ length: 4 }, (_, index) => inst('AUDIT-DUMMY', `deck-${index}`));
  let shuffleCalls = 0;

  s = applyAction(s, 0, attack, [...pool, yellowTarget], () => { shuffleCalls += 1; return 0; });
  assert.equal(s.players[1].zones.center.damage, 180);
  assert.equal(shuffleCalls, 0);
  assert.deepEqual(s.players[0].mainDeck.map(card => card.id), ['deck-0', 'deck-1', 'deck-2', 'deck-3']);
});

test('hBP08-076 Arts adds its printed 50 against a Blue target', () => {
  const blueTarget = { ...dummy, number: 'AUDIT-076-BLUE', colors: ['藍'] };
  let s = state('hBP08-076');
  fund(s.players[0].zones.center, ['紫', '無色', '無色']);
  s.players[1].zones.center = unit(blueTarget.number);
  s = applyAction(s, 0, attack, [...pool, blueTarget], () => 0);
  assert.equal(s.players[1].zones.center.damage, 170);
});

test('hBP08-078 Collab buffs only a friendly 2nd Holomen with #歌 for this turn', () => {
  const legal = holomem(card => card.stage === '2nd' && card.tags.includes('#歌'));
  const illegal = holomem(card => card.stage === '2nd' && !card.tags.includes('#歌'));
  assert.ok(legal && illegal);
  let s = state();
  s.phase = 'main';
  s.players[0].zones.back1 = unit('hBP08-078');
  s.players[0].zones.center = unit(legal.number);
  s.players[0].zones.back2 = unit(illegal.number);

  s = applyAction(s, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.equal(s.pendingChoice?.effect, 'addModifier');
  assert.deepEqual(s.pendingChoice.options, ['center']);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 20), true);
  assert.equal(s.players[0].zones.back2.modifiers.some(modifier => modifier.kind === 'arts'), false);
});

test('hBP08-079 Arts can attach an archived Cheer only to own Center #ReGLOSS', () => {
  const cheer = cards.find(card => card.group === 'cheer');
  assert.ok(cheer);
  let s = state('hBP08-079');
  fund(s.players[0].zones.center, ['無色']);
  s.players[0].archive = [inst(cheer.number, 'archived-cheer')];
  s.players[0].zones.back1 = unit('hBP08-078');

  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.pendingChoice?.effect, 'archiveCheerToStage');
  assert.equal(s.pendingChoice.optional, true);
  s = applyAction(s, 0, { type: 'choose', cardIds: ['archived-cheer'] }, pool, () => 0);
  assert.deepEqual(s.pendingChoice.options, ['center']);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.players[0].zones.center.cheer.some(card => card.id === 'archived-cheer'), true);
  assert.equal(s.players[0].zones.back1.cheer.some(card => card.id === 'archived-cheer'), false);
  assert.equal(s.players[1].zones.center.damage, 10);
});

test('hBP08-079 Gift gives this Holomen +50 HP while own stage has a #ReGLOSS 2nd', () => {
  const reglossSecond = holomem(card => card.stage === '2nd' && card.tags.includes('#ReGLOSS'));
  assert.ok(reglossSecond);
  let s = state('hBP08-079', 'hBP08-077');
  s.players[0].zones.center.damage = 160;
  s.players[0].zones.back1 = unit(reglossSecond.number);
  fund(s.players[1].zones.center, ['無色']);
  s.activePlayer = 1;
  s = applyAction(s, 1, attack, pool, () => 0);
  assert.equal(s.players[0].zones.center.damage, 180);
  assert.equal(s.players[0].zones.center.stack.at(-1).number, 'hBP08-079');
});

test('hBP08-080 Bloom searches a ReGLOSS Debut to an open Back slot only when own stage has more Cheer', () => {
  const legal = holomem(card => card.stage === 'Debut' && card.tags.includes('#ReGLOSS'));
  const illegal = holomem(card => card.stage === 'Debut' && !card.tags.includes('#ReGLOSS'));
  assert.ok(legal && illegal);
  let s = state('hBP08-078');
  s.phase = 'main';
  fund(s.players[0].zones.center, ['黃']);
  s.players[0].hand = [inst('hBP08-080', 'bloom')];
  s.players[0].mainDeck = [inst(legal.number, 'legal'), inst(legal.number, 'legal-2'), inst(illegal.number, 'wrong-1'), inst(illegal.number, 'wrong-2')];
  let shuffleCalls = 0;

  s = applyAction(s, 0, { type: 'play', cardId: 'bloom' }, pool, () => { shuffleCalls += 1; return 0; });
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => { shuffleCalls += 1; return 0; });
  assert.equal(s.pendingChoice?.effect, 'deckCardsToStage');
  assert.equal(s.pendingChoice.optional, true);
  assert.equal(s.pendingChoice.max, 1);
  s = applyAction(s, 0, { type: 'choose', cardIds: ['legal'] }, pool, () => { shuffleCalls += 1; return 0; });
  s = applyAction(s, 0, { type: 'choose', zone: 'back1' }, pool, () => { shuffleCalls += 1; return 0; });
  assert.equal(s.players[0].zones.back1.stack.at(-1).number, legal.number);
  assert.equal(shuffleCalls > 0, true);

  s = state('hBP08-078');
  s.phase = 'main';
  fund(s.players[0].zones.center, ['黃']);
  fund(s.players[1].zones.center, ['紫']);
  s.players[0].hand = [inst('hBP08-080', 'bloom')];
  s.players[0].mainDeck = [inst(legal.number, 'legal')];
  s = applyAction(s, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.pendingChoice, null);
  assert.equal(s.players[0].mainDeck[0].id, 'legal');
});
