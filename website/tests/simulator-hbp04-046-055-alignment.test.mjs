import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {cards,pool,unit,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';

const engineUrl = process.env.HOLO_ENGINE_PATH
  ? pathToFileURL(resolve(process.env.HOLO_ENGINE_PATH))
  : new URL('../lib/simulator/engine.mjs', import.meta.url);
const {applyAction} = await import(engineUrl);

const redTarget = cards.find(entry => entry.group === 'holomem' && entry.colors?.includes('紅') && entry.hp >= 200);
const whiteTarget = cards.find(entry => entry.group === 'holomem' && entry.colors?.includes('白') && entry.hp >= 200);

test('047 Lamy Collab requires Snowmin attached to Lamy and its special damage does not take Life on Down', () => {
  const makeState = attached => {
    const s = state('AUDIT-DUMMY');
    s.phase = 'main';
    s.players[0].zones.back1 = unit('hBP04-047', {attachments: attached ? [inst('hBP04-106', 'snowmin')] : []});
    s.players[1].zones.center = unit('AUDIT-DUMMY', {damage: 9990});
    return s;
  };
  let s = applyAction(makeState(false), 0, {type:'collab',zone:'back1'}, pool, () => 0);
  assert.equal(s.pendingChoice, null);
  assert.equal(s.players[1].zones.center.damage, 9990);

  s = applyAction(makeState(true), 0, {type:'collab',zone:'back1'}, pool, () => 0);
  assert.equal(s.pendingChoice.optional, false);
  assert.deepEqual(s.pendingChoice.options, ['center']);
  s = applyAction(s, 0, {type:'choose',zone:'center'}, pool, () => 0);
  assert.equal(s.players[1].zones.center, null);
  assert.equal(s.players[1].life.length, 5);
});

test('048 Arts applies its catalogued red-target +50', () => {
  let s = state('hBP04-048', redTarget.number);
  fund(s.players[0].zones.center, ['藍','無色','無色']);
  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.pendingChoice.effect, 'artArchiveCheerCost');
  s = applyAction(s, 0, {type:'choose',skip:true}, pool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 180);
});

test('048 Arts optionally archives one source Cheer, then deals 30 special damage to opposing Center or Back', () => {
  let s = state('hBP04-048', redTarget.number);
  fund(s.players[0].zones.center, ['藍','無色','無色','紅']);
  s.players[1].zones.back1 = unit('AUDIT-DUMMY');
  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.pendingChoice.effect, 'artArchiveCheerCost');
  assert.equal(s.pendingChoice.optional, true);
  assert.deepEqual(s.pendingChoice.cheerOptions.map(option => option.zone), ['center','center','center','center']);
  s = applyAction(s, 0, {type:'choose',cheerId:'cheer3'}, pool, () => 0);
  assert.equal(s.players[0].archive.some(instance => instance.id === 'cheer3'), true);
  assert.equal(s.pendingChoice.effect, 'specialDamage');
  assert.deepEqual(s.pendingChoice.options, ['center','back1']);
  s = applyAction(s, 0, {type:'choose',zone:'back1'}, pool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 180);
  assert.equal(s.players[1].zones.back1.damage, 30);
});

test('048 Arts can skip its Cheer cost without dealing the conditional damage', () => {
  let s = state('hBP04-048', redTarget.number);
  fund(s.players[0].zones.center, ['藍','無色','無色','紅']);
  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.pendingChoice.effect, 'artArchiveCheerCost');
  s = applyAction(s, 0, {type:'choose',skip:true}, pool, () => 0);
  assert.equal(s.pendingChoice, null);
  assert.equal(s.players[0].archive.length, 0);
  assert.equal(s.players[1].zones.center.damage, 180);
});

test('049 first Arts receives its white-target +50', () => {
  let s = state('hBP04-049', whiteTarget.number);
  fund(s.players[0].zones.center, ['無色']);
  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 100);
});

test('049 second Arts applies white-target and different-color bonuses independently', () => {
  for (const {differentColor, expected} of [{differentColor:false,expected:130},{differentColor:true,expected:180}]) {
    let s = state('hBP04-049', whiteTarget.number);
    if (differentColor) s.players[0].zones.back1 = unit(whiteTarget.number);
    fund(s.players[0].zones.center, ['藍','無色','無色']);
    s = applyAction(s, 0, {...attack,artIndex:1}, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, expected, `differentColor=${differentColor}`);
  }
});

test('055 Arts gains 10 per rested opposing Holomen', () => {
  for (const {restedCount, expected} of [{restedCount:0,expected:30},{restedCount:2,expected:50}]) {
    let s = state('hBP04-055');
    fund(s.players[0].zones.center, ['紫']);
    s.players[1].zones.back1 = unit('AUDIT-DUMMY', {rested: restedCount >= 1});
    s.players[1].zones.back2 = unit('AUDIT-DUMMY', {rested: restedCount >= 2});
    s = applyAction(s, 0, attack, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, expected, `restedCount=${restedCount}`);
  }
});
