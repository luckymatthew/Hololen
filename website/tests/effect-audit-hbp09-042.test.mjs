import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, settle, conserve } from './hbp09-fixtures.mjs';

const red = count => Array.from({ length: count }, () => instance('hY03-017'));
const white = count => Array.from({ length: count }, () => instance('hY01-015'));
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 });

function replaceStage(player, zones) {
  for (const old of Object.values(player.zones)) {
    if (old) player.archive.push(...old.stack, ...old.cheer, ...old.attachments);
  }
  player.zones = { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null, ...zones };
}

function attackFixture({ archive = ['hBP09-106', 'hBP09-041'], target = 'hBP09-064', targetDamage = 60 } = {}) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'performance';
  const attacker = state.players[0];
  replaceStage(attacker, { center: unit('hBP09-042') });
  attacker.zones.center.cheer = red(2);
  attacker.archive = archive.map(instance);
  attacker.turnsTaken = 3;
  attacker.turnEvents = turnEvents(state.turn);

  const defender = state.players[1];
  replaceStage(defender, { center: unit(target), back1: unit('hBP09-064') });
  defender.zones.center.damage = targetDamage;
  defender.turnsTaken = 3;
  defender.turnEvents = turnEvents(state.turn);
  defender.archive.push(...defender.life);
  defender.life = ['hY01-015', 'hY02-013', 'hY03-017', 'hY04-014', 'hY05-012'].map(instance);
  return state;
}

function incomingDownFixture({ top = 'hBP09-042', priorDamage = 120 } = {}) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 1;
  state.phase = 'performance';
  state.players.forEach(player => {
    player.turnsTaken = 3;
    player.turnEvents = turnEvents(state.turn);
  });
  const attacker = state.players[1];
  replaceStage(attacker, { center: unit('hBP09-023') });
  attacker.zones.center.cheer = white(3);
  const defender = state.players[0];
  replaceStage(defender, { center: unit(top), back1: unit('hBP09-064') });
  if (top === 'hBP09-043') defender.zones.center.stack = [instance('hBP09-042'), instance('hBP09-043')];
  defender.zones.center.damage = priorDamage;
  defender.archive.push(...defender.life);
  defender.life = ['hY01-015', 'hY02-013', 'hY03-017', 'hY04-014', 'hY05-012'].map(instance);
  return state;
}

function attack042(state, playerIndex = 0) {
  return act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, playerIndex, cards);
}

test('hBP09-042 official card identity and printed clauses match the live official Japanese card entry', () => {
  const card = cards.find(entry => entry.number === 'hBP09-042');
  assert.ok(card);
  assert.equal(card.jpName, 'カエラ・コヴァルスキア');
  assert.equal(card.typeCode, 'buzzCharacter');
  assert.equal(card.stage, '1st');
  assert.equal(card.hp, 240);
  assert.equal(card.arts[0].name, '木立にひそむ神秘');
  assert.deepEqual(card.arts[0].cost, ['紅', '紅']);
  assert.equal(card.arts[0].damage, 70);
  assert.equal(card.arts[0].effect, "自分のアーカイブの#カエラ'sアームズを持つツール1枚をこのホロメンに付ける。");
  assert.equal(card.keyword.effect, 'このホロメンが相手のホロメンをダウンさせた時、自分のアーカイブのホロメン1枚を手札に戻す。');
  assert.equal(card.extra, 'このホロメンがダウンした時、自分のライフ-2');
});

test('the actual hBP09-042 Arts Down attaches one matching Tool and its downing Gift returns exactly one archived Holomem', () => {
  const state = attackFixture();
  const before = structuredClone(state);
  let result = attack042(state);
  assert.ok(result.pendingChoice, 'the Arts must ask which matching Archive Tool to attach');
  assert.equal(result.pendingChoice.type, 'cardSelection');
  assert.deepEqual(result.pendingChoice.selectableIds.map(id => result.players[0].archive.find(card => card.id === id)?.number), ['hBP09-106']);
  result = act(result, { type: 'choose', cardIds: [result.pendingChoice.selectableIds[0]] }, result.pendingChoice.playerIndex, cards);
  assert.equal(result.pendingChoice?.type, 'cardSelection', 'the Arts Down then triggers Kaela\'s archived-Holomem Gift');
  assert.deepEqual(result.pendingChoice.selectableIds.map(id => result.players[0].archive.find(card => card.id === id)?.number), ['hBP09-041']);
  result = act(result, { type: 'choose', cardIds: [result.pendingChoice.selectableIds[0]] }, result.pendingChoice.playerIndex, cards);
  result = settle(result, cards);
  assert.equal(result.players[1].zones.center, null, '70 Arts damage Downs the 130 HP target already marked for 60 damage');
  assert.equal(result.players[0].zones.center.attachments[0].number, 'hBP09-106');
  assert.deepEqual(result.players[0].hand.map(card => card.number), ['hBP09-041']);
  assert.deepEqual(result.players[0].archive.map(card => card.number), []);
  assert.equal(result.players[1].life.length, 4, 'the ordinary non-Buzz target loses one Life');
  assert.equal(result.lifeLosses.filter(loss => loss.ownerIndex === 1).length, 1);
  conserve(before, result);
});

test('hBP09-042 Arts with no matching Tool and a Down with no archived Holomem resolves without an impossible choice', () => {
  const state = attackFixture({ archive: [], targetDamage: 60 });
  const result = settle(attack042(state), cards);
  assert.equal(result.pendingChoice, null, 'an empty Arts attachment set and empty Gift recovery set do not open choices');
  assert.equal(result.players[0].archive.length, 0);
  assert.equal(result.players[0].hand.length, 0);
  assert.equal(result.players[1].zones.center, null, 'the 70 Arts still resolves and Downs the target');
  assert.equal(result.players[1].life.length, 4, 'the opponent still loses the ordinary Down Life');
});

test('active-top hBP09-042 Down processes exactly two Life; covering it with 2nd Kaela returns to one', () => {
  const buzzState = incomingDownFixture();
  const before = structuredClone(buzzState);
  const buzz = settle(act(buzzState, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 1, cards), cards);
  assert.equal(buzz.players[0].zones.center, null);
  assert.equal(buzz.players[0].life.length, 3);
  assert.equal(buzz.lifeLosses.filter(loss => loss.ownerIndex === 0).length, 2, 'Buzz Down replaces the normal one-Life loss with two');
  assert.equal(buzz.players[0].zones.back1.cheer.length, 2);
  conserve(before, buzz);

  const coveredState = incomingDownFixture({ top: 'hBP09-043', priorDamage: 80 });
  const covered = settle(act(coveredState, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 1, cards), cards);
  assert.equal(covered.players[0].zones.center, null);
  assert.equal(covered.players[0].life.length, 4);
  assert.equal(covered.lifeLosses.filter(loss => loss.ownerIndex === 0).length, 1, 'the current top 2nd card governs Down Life loss');
  assert.equal(covered.players[0].zones.back1.cheer.length, 1);
});
