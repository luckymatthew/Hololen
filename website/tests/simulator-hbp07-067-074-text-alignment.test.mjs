import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, inst, unit, state, fund, attack } from './fixtures/simulator-audit.mjs';

const card = (number) => cards.find((entry) => entry.number === number);

for (const pay of [true, false]) {
  test(`hBP07-067 Arts optionally archives one hand card before choosing Center/Collab special damage (${pay})`, () => {
    const game = state('hBP07-067');
    fund(game.players[0].zones.center, card('hBP07-067').arts[0].cost);
    game.players[0].hand = [inst('AUDIT-DUMMY', 'discard-me')];
    game.players[1].zones.collab = unit('AUDIT-DUMMY', { stack: [inst('AUDIT-DUMMY', 'opponent-collab')] });

    let result = applyAction(game, 0, attack, pool, () => 0);
    assert.equal(result.pendingChoice?.effect, 'genericKeywordHandArchiveCost');
    assert.equal(result.pendingChoice?.optional, true);
    assert.deepEqual(result.pendingChoice?.selectableIds, ['discard-me']);
    result = applyAction(result, 0, pay
      ? { type: 'choose', cardIds: ['discard-me'] }
      : { type: 'choose', skip: true }, pool, () => 0);

    if (pay) {
      assert.equal(result.pendingChoice?.effect, 'specialDamage');
      assert.deepEqual(result.pendingChoice?.options, ['center', 'collab']);
      result = applyAction(result, 0, { type: 'choose', zone: 'collab' }, pool, () => 0);
      assert.equal(result.players[0].archive[0].id, 'discard-me');
      assert.equal(result.players[1].zones.center.damage, 40);
      assert.equal(result.players[1].zones.collab.damage, 20);
    } else {
      assert.equal(result.pendingChoice, null);
      assert.equal(result.players[0].archive.length, 0);
      assert.equal(result.players[1].zones.center.damage, 40);
      assert.equal(result.players[1].zones.collab.damage, 0);
    }
  });
}

for (const valid of [true, false]) {
  test(`hBP07-067 Bloom looks at four and searches exactly one AZKi (${valid})`, () => {
    const prior = cards.find((entry) => entry.group === 'holomem' && entry.jpName === 'AZKi' && entry.stage === 'Debut');
    const other = cards.find((entry) => entry.group === 'holomem' && entry.jpName !== 'AZKi');
    const game = state(prior.number);
    game.phase = 'main';
    game.players[0].hand = [inst('hBP07-067', 'bloom')];
    game.players[0].mainDeck = [
      inst(other.number, 'first'),
      inst(valid ? prior.number : other.number, 'azki'),
      inst(other.number, 'third'),
      inst(other.number, 'fourth'),
      inst(other.number, 'tail'),
    ];
    let result = applyAction(game, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
    result = applyAction(result, 0, { type: 'choose', zone: 'center' }, pool, () => 0);

    if (valid) {
      assert.equal(result.pendingChoice?.effect, 'genericTopLook');
      assert.equal(result.pendingChoice?.optional, false);
      assert.deepEqual(result.pendingChoice?.selectableIds, ['azki']);
      result = applyAction(result, 0, { type: 'choose', cardIds: ['azki'] }, pool, () => 0);
      assert.equal(result.pendingChoice?.effect, 'bottomOrder');
      result = applyAction(result, 0, { type: 'choose', cardIds: ['fourth', 'third', 'first'] }, pool, () => 0);
      assert.equal(result.players[0].hand.at(-1).id, 'azki');
      assert.deepEqual(result.players[0].mainDeck.map((entry) => entry.id), ['tail', 'fourth', 'third', 'first']);
    } else {
      assert.equal(result.pendingChoice?.effect, 'bottomOrder');
      assert.equal(result.pendingChoice?.min, 4);
      result = applyAction(result, 0, { type: 'choose', cardIds: ['fourth', 'third', 'azki', 'first'] }, pool, () => 0);
      assert.equal(result.players[0].hand.length, 0);
      assert.deepEqual(result.players[0].mainDeck.map((entry) => entry.id), ['tail', 'fourth', 'third', 'azki', 'first']);
    }
  });
}

test('hBP07-068 Arts adds its printed +50 against Yellow', () => {
  const yellow = { ...pool.find((entry) => entry.number === 'AUDIT-DUMMY'), number: 'YELLOW-AUDIT', colors: ['黃'], hp: 10000 };
  const testPool = [...pool, yellow];
  const game = state('hBP07-068', yellow.number);
  fund(game.players[0].zones.center, card('hBP07-068').arts[0].cost);
  const result = applyAction(game, 0, attack, testPool, () => 0);
  assert.equal(result.players[1].zones.center.damage, 150);
});

for (const distinctNames of [false, true]) {
  test(`hBP07-068 Collab counts distinct #0期生 names (${distinctNames})`, () => {
    const game = state();
    game.phase = 'main';
    game.players[0].zones.center = unit('hBP01-044');
    game.players[0].zones.back1 = unit('hBP07-068');
    game.players[0].zones.back2 = unit('hBP01-045');
    if (distinctNames) game.players[0].zones.back3 = unit('hBP01-021');

    const result = applyAction(game, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    const modifier = result.players[0].zones.collab.modifiers.find((entry) => entry.sourceNumber === 'hBP07-068');
    assert.equal(modifier?.kind, 'arts');
    assert.equal(modifier?.amount, distinctNames ? 40 : 20);
  });
}

test('hBP07-069 first Arts draws two and adds +50 against Green', () => {
  const green = { ...pool.find((entry) => entry.number === 'AUDIT-DUMMY'), number: 'GREEN-AUDIT', colors: ['綠'], hp: 10000 };
  const testPool = [...pool, green];
  const game = state('hBP07-069', green.number);
  fund(game.players[0].zones.center, card('hBP07-069').arts[0].cost);
  game.players[0].mainDeck = [inst('AUDIT-DUMMY', 'draw-1'), inst('AUDIT-DUMMY', 'draw-2')];

  const result = applyAction(game, 0, attack, testPool, () => 0);
  assert.deepEqual(result.players[0].hand.map((entry) => entry.id), ['draw-1', 'draw-2']);
  assert.equal(result.players[1].zones.center.damage, 190);
});

test('hBP07-069 second Arts must not offer its four-Holo-Power cost unless the Oshi is AZKi', () => {
  const game = state('hBP07-069');
  fund(game.players[0].zones.center, card('hBP07-069').arts[1].cost);
  game.players[0].archive = Array.from({ length: 3 }, (_, index) => inst('hBP07-100', `frontier-${index}`));
  game.players[0].holoPower = Array.from({ length: 4 }, (_, index) => inst('AUDIT-DUMMY', `power-${index}`));

  const result = applyAction(game, 0, { ...attack, artIndex: 1 }, pool, () => 0);
  assert.notEqual(result.pendingChoice?.effect, 'genericKeywordPowerCost');
  assert.equal(result.players[0].archive.length, 3);
  assert.equal(result.players[1].life.length, 5);
});

for (const powerContainsFrontier of [false, true]) {
  test(`hBP07-069 second Arts checks Frontier Spirit after its optional Holo-Power cost (${powerContainsFrontier})`, () => {
    const azki = cards.find((entry) => entry.group === 'oshi' && entry.jpName === 'AZKi');
    const game = state('hBP07-069');
    fund(game.players[0].zones.center, card('hBP07-069').arts[1].cost);
    game.players[0].oshi = inst(azki.number, 'azki-oshi');
    game.players[0].archive = Array.from({ length: 3 }, (_, index) => inst('hBP07-100', `frontier-${index}`));
    game.players[0].holoPower = [
      inst('AUDIT-DUMMY', 'power-1'),
      inst('AUDIT-DUMMY', 'power-2'),
      inst('AUDIT-DUMMY', 'power-3'),
      inst(powerContainsFrontier ? 'hBP07-100' : 'AUDIT-DUMMY', 'power-4'),
    ];

    let result = applyAction(game, 0, { ...attack, artIndex: 1 }, pool, () => 0);
    assert.equal(result.pendingChoice?.effect, 'genericKeywordPowerCost');
    result = applyAction(result, 0, { type: 'choose', optionId: 'use' }, pool, () => 0);
    assert.equal(result.players[0].archive.length, 7);
    assert.equal(result.players[1].life.length, powerContainsFrontier ? 4 : 5);
  });
}

for (const usedEvents of [0, 2]) {
  test(`hBP07-070 Arts reduces a chosen #料理 member's Colorless cost by used #食物 Events (${usedEvents})`, () => {
    const game = state('hBP07-070');
    fund(game.players[0].zones.center, card('hBP07-070').arts[0].cost);
    game.players[0].zones.back1 = unit('hBP02-024');
    game.players[0].archive = [inst('hBP05-076', 'old-food-event')];
    if (usedEvents > 0) game.players[0].turnEvents = {
      turn: game.turn,
      supports: ['hBP05-076', 'hBP05-075'],
      arts: [],
      bloomCount: 0,
      cheerArchived: 0,
      deckArchived: 0,
      stageReturned: 0,
    };

    let result = applyAction(game, 0, attack, pool, () => 0);
    if (usedEvents === 0) {
      assert.equal(result.pendingChoice, null);
      assert.equal(result.players[0].zones.back1.modifiers.length, 0);
    } else {
      assert.equal(result.pendingChoice?.effect, 'artFoodCostReduction');
      result = applyAction(result, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
      const modifier = result.players[0].zones.back1.modifiers.find((entry) => entry.sourceNumber === 'hBP07-070');
      assert.equal(modifier?.kind, 'artCost');
      assert.equal(modifier?.amount, -usedEvents);
    }
  });
}

for (const [number, damage, cost] of [['hBP07-071', 30, ['紫']], ['hBP07-072', 60, ['紫', '無色']]]) {
  test(`${number} basic Arts uses its printed cost and damage`, () => {
    const game = state(number);
    fund(game.players[0].zones.center, cost);
    const result = applyAction(game, 0, attack, pool, () => 0);
    assert.equal(result.players[1].zones.center.damage, damage);
  });
}

test('hBP07-072 Bloom chooses the #holoX recipient before rolling three dice', () => {
  const prior = card('hBP07-071');
  const game = state(prior.number);
  game.phase = 'main';
  game.players[0].zones.back1 = unit('hBP01-056');
  game.players[0].hand = [inst('hBP07-072', 'bloom')];
  let result = applyAction(game, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
  result = applyAction(result, 0, { type: 'choose', zone: 'center' }, pool, () => 0);

  assert.equal(result.pendingChoice?.type, 'stageTarget');
  assert.equal(result.pendingChoice?.effect, 'hBP07LaplusBloomDiceArts');
  assert.equal(result.players[0].turnEvents?.diceRollCount || 0, 0);
  assert.deepEqual(result.pendingChoice?.options, ['center', 'back1']);

  const rolls = [0, 0.17, 0.34];
  let index = 0;
  result = applyAction(result, 0, { type: 'choose', zone: 'back1' }, pool, () => rolls[index++]);
  assert.equal(index, 3);
  assert.equal(result.players[0].turnEvents.diceRollCount, 3);
  assert.equal(result.players[0].zones.back1.modifiers.find((entry) => entry.sourceNumber === 'hBP07-072')?.amount, 20);
});

test('hBP07-073 Collab reduces this Holomen’s Colorless Arts cost by two for the turn', () => {
  const game = state();
  game.phase = 'main';
  game.players[0].zones.back1 = unit('hBP07-073');
  const result = applyAction(game, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  const modifier = result.players[0].zones.collab.modifiers.find((entry) => entry.sourceNumber === 'hBP07-073');
  assert.equal(modifier?.kind, 'artCost');
  assert.equal(modifier?.amount, -2);
  assert.equal(modifier?.expiresTurn, result.turn);
});

for (const centerPurple of [false, true]) {
  test(`hBP07-074 Arts checks the Center color before its +40 (${centerPurple})`, () => {
    const green = { ...pool.find((entry) => entry.number === 'AUDIT-DUMMY'), number: 'GREEN-AUDIT', colors: ['綠'], hp: 10000 };
    const testPool = [...pool, green];
    const purpleCenter = cards.find((entry) => entry.group === 'holomem' && entry.colors?.includes('紫'));
    const otherCenter = cards.find((entry) => entry.group === 'holomem' && !entry.colors?.includes('紫'));
    const game = state('hBP07-074', green.number);
    game.players[0].zones.center = unit((centerPurple ? purpleCenter : otherCenter).number);
    game.players[0].zones.collab = unit('hBP07-074');
    fund(game.players[0].zones.collab, card('hBP07-074').arts[0].cost);

    const result = applyAction(game, 0, { ...attack, sourceZone: 'collab' }, testPool, () => 0);
    assert.equal(result.players[1].zones.center.damage, centerPurple ? 200 : 160);
  });
}

test('hBP07-074 Bloom may add any number of revealed Holomen and orders the rest to the bottom', () => {
  const prior = card('hBP07-073');
  const holomemA = cards.find((entry) => entry.group === 'holomem' && entry.number !== prior.number);
  const holomemB = cards.find((entry) => entry.group === 'holomem' && entry.number !== prior.number && entry.number !== holomemA.number);
  const support = cards.find((entry) => entry.group === 'support');
  const game = state(prior.number);
  game.phase = 'main';
  game.players[0].hand = [inst('hBP07-074', 'bloom')];
  game.players[0].mainDeck = [inst(support.number, 'first'), inst(holomemA.number, 'pick-a'), inst(holomemB.number, 'pick-b'), inst('AUDIT-DUMMY', 'tail')];
  let result = applyAction(game, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
  result = applyAction(result, 0, { type: 'choose', zone: 'center' }, pool, () => 0);

  assert.equal(result.pendingChoice?.effect, 'genericTopLook');
  assert.equal(result.pendingChoice?.min, 0);
  assert.equal(result.pendingChoice?.max, 2);
  assert.deepEqual(result.pendingChoice?.selectableIds, ['pick-a', 'pick-b']);
  result = applyAction(result, 0, { type: 'choose', cardIds: ['pick-a', 'pick-b'] }, pool, () => 0);
  assert.equal(result.pendingChoice?.effect, 'bottomOrder');
  result = applyAction(result, 0, { type: 'choose', cardIds: ['first'] }, pool, () => 0);
  assert.deepEqual(result.players[0].hand.map((entry) => entry.id), ['pick-a', 'pick-b']);
  assert.deepEqual(result.players[0].mainDeck.map((entry) => entry.id), ['tail', 'first']);
});
