import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, isActionCandidateLegal } from '../lib/simulator/engine.mjs';
import { cards, inst, state, attack, pool, unit, fund } from './fixtures/simulator-audit.mjs';

test('hBP08-057 red Cheer Arts bonus adds 20 damage only while a red Cheer is attached', () => {
  let s = state('hBP08-057');
  s.players[0].zones.center.cheer = [inst('hY04-001', 'blue'), inst('hY03-001', 'red')];
  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 50);

  s = state('hBP08-057');
  s.players[0].zones.center.cheer = [inst('hY04-001', 'blue')];
  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 30);
});

test('hBP08-059 may transfer a red Cheer from any own Holomen to a Mococo', () => {
  let s = state('hBP08-059');
  s.players[0].zones.center.cheer = [
    inst('hY04-001', 'blue-1'),
    inst('hY04-001', 'blue-2'),
    inst('hY04-001', 'blue-3'),
  ];
  s.players[0].zones.back1 = unit('hBP08-057', { cheer: [inst('hY03-001', 'red-other-unit')] });
  s.players[0].zones.back2 = unit('hBP08-034');

  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.pendingChoice?.effect, 'boundaryTransferTarget');
  s = applyAction(s, 0, { type: 'choose', zone: 'back2' }, pool, () => 0);
  assert.deepEqual(s.pendingChoice?.cheerOptions?.map(option => option.id), ['red-other-unit']);
  s = applyAction(s, 0, { type: 'choose', cheerId: 'red-other-unit' }, pool, () => 0);

  assert.equal(s.players[0].zones.back1.cheer.length, 0);
  assert.ok(s.players[0].zones.back2.cheer.some(cheer => cheer.id === 'red-other-unit'));
});

test('hBP08-039 keeps its blue-Cheer bonus and transfer limited to that Mococo', () => {
  let s = state('hBP08-039');
  fund(s.players[0].zones.center, ['紅', '紅', '紅']);
  s.players[0].zones.back1 = unit('hBP08-057', { cheer: [inst('hY04-001', 'blue-other-unit')] });

  s = applyAction(s, 0, attack, pool, () => 0);

  assert.equal(s.players[1].zones.center.damage, 90, 'blue Cheer on another Holomen does not raise Mococo Arts damage');
  assert.equal(s.pendingChoice, null, 'blue Cheer on another Holomen is not offered for transfer');
});

test('hBP08-059 Arts gains 50 only after own Mococo used Arts this turn', () => {
  for (const usedMococo of [false, true]) {
    let s = state('hBP08-059');
    fund(s.players[0].zones.center, ['藍', '藍', '藍']);
    if (usedMococo) s.players[0].turnEvents = { turn: s.turn, supports: [], arts: ['hBP08-039'], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
    s = applyAction(s, 0, attack, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, usedMococo ? 130 : 80);
  }
});

test('hBP08-059 Gift permits non-Debut Back Arts targets only at six Red Cheer', () => {
  const action = { ...attack, targetZone: 'back1' };
  const createState = (redCount, backNumber = 'hBP08-057') => {
    const s = state('hBP08-059');
    s.players[0].zones.center.cheer = [
      ...Array.from({ length: 3 }, (_, index) => inst('hY04-001', `blue-${index}`)),
      ...Array.from({ length: redCount }, (_, index) => inst('hY03-001', `red-${index}`)),
    ];
    s.players[1].zones.back1 = unit(backNumber);
    return s;
  };

  assert.equal(isActionCandidateLegal(createState(5), 0, action, pool), false);
  assert.equal(isActionCandidateLegal(createState(6), 0, action, pool), true);
  assert.equal(isActionCandidateLegal(createState(6, 'hBP08-034'), 0, action, pool), false, 'Debut remains ineligible');
});

test('hBP08-057 Collab moves selected stage Cheer to one Mococo then checks total Cheer', () => {
  let s = state();
  s.phase = 'main';
  s.players[0].zones.back1 = unit('hBP08-057', {
    cheer: Array.from({ length: 4 }, (_, index) => inst('hY04-001', `fuwawa-${index}`)),
  });
  s.players[0].zones.center = unit('hBP08-034', {
    cheer: Array.from({ length: 4 }, (_, index) => inst('hY01-001', `mococo-${index}`)),
  });

  s = applyAction(s, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.equal(s.pendingChoice?.effect, 'genericMoveCheerTargetFirst');
  assert.deepEqual(s.pendingChoice.options, ['center']);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.pendingChoice?.effect, 'genericMoveCheer');
  s = applyAction(s, 0, { type: 'choose', cheerId: 'fuwawa-0' }, pool, () => 0);
  s = applyAction(s, 0, { type: 'choose', skip: true }, pool, () => 0);

  assert.equal(s.players[0].zones.collab.cheer.length, 3);
  assert.equal(s.players[0].zones.center.cheer.length, 5);
  assert.ok(s.players[0].zones.collab.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 40));
});

test('hBP08-058 first Arts selects only archived Blue Cheer for own Advent Holomen', () => {
  let s = state('hBP08-058');
  fund(s.players[0].zones.center, ['藍', '無色']);
  s.players[0].archive = [
    inst('hY04-001', 'archived-blue-1'),
    inst('hY03-001', 'archived-red'),
    inst('hY04-001', 'archived-blue-2'),
  ];
  s.players[0].zones.back1 = unit('hBP08-057');

  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.pendingChoice?.effect, 'archiveCheerToStage');
  assert.equal(s.pendingChoice.min, 1);
  assert.equal(s.pendingChoice.max, 2);
  assert.deepEqual(s.pendingChoice.selectableIds, ['archived-blue-1', 'archived-blue-2']);
  s = applyAction(s, 0, { type: 'choose', cardIds: ['archived-blue-1'] }, pool, () => 0);
  assert.equal(s.pendingChoice?.type, 'stageTarget');
  assert.deepEqual(s.pendingChoice.options, ['center', 'back1']);
  s = applyAction(s, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);

  assert.ok(s.players[0].zones.back1.cheer.some(cheer => cheer.id === 'archived-blue-1'));
  assert.deepEqual(s.players[0].archive.map(card => card.id), ['archived-red', 'archived-blue-2']);
});

test('hBP08-061 Collab takes the opponent Holo Power top card only for second-player first turn with Lui Oshi', () => {
  const luiOshi = cards.find(card => card.group === 'oshi' && card.jpName === '鷹嶺ルイ');
  assert.ok(luiOshi, 'the existing catalogue contains the printed Lui Oshi');
  let s = state();
  s.phase = 'main';
  s.firstPlayer = 0;
  s.activePlayer = 1;
  s.players[1].turnsTaken = 1;
  s.players[1].oshi = inst(luiOshi.number);
  s.players[1].zones.back1 = unit('hBP08-061');
  s.players[0].holoPower = [inst('hY01-001', 'opponent-old-power'), inst('hY02-001', 'opponent-top-power')];

  s = applyAction(s, 1, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.deepEqual(s.players[0].hand.map(card => card.id), ['opponent-top-power']);
  assert.deepEqual(s.players[0].holoPower.map(card => card.id), ['opponent-old-power']);

  s = state();
  s.phase = 'main';
  s.firstPlayer = 0;
  s.activePlayer = 1;
  s.players[1].turnsTaken = 2;
  s.players[1].oshi = inst(luiOshi.number);
  s.players[1].zones.back1 = unit('hBP08-061');
  s.players[0].holoPower = [inst('hY02-001', 'not-transferred')];
  s = applyAction(s, 1, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.deepEqual(s.players[0].hand, []);
  assert.deepEqual(s.players[0].holoPower.map(card => card.id), ['not-transferred']);
});

for (const [number, color, damage] of [
  ['hBP08-061', '無色', 30],
  ['hBP08-062', '無色', 20],
  ['hBP08-063', '紫', 40],
]) {
  test(`${number} unmodified Arts uses its printed cost and damage`, () => {
    let s = state(number);
    fund(s.players[0].zones.center, [color]);
    s = applyAction(s, 0, attack, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, damage);
  });
}
