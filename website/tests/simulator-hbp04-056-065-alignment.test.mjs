import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {cards,pool,state,fund,attack} from './fixtures/simulator-audit.mjs';

const engineUrl = process.env.HOLO_ENGINE_PATH
  ? pathToFileURL(resolve(process.env.HOLO_ENGINE_PATH))
  : new URL('../lib/simulator/engine.mjs', import.meta.url);
const {applyAction} = await import(engineUrl);
const blueTarget = cards.find(entry => entry.group === 'holomem' && entry.colors?.includes('藍') && entry.hp >= 200);
const greenTarget = cards.find(entry => entry.group === 'holomem' && entry.colors?.includes('綠') && entry.hp >= 150);

test('059 Arts applies its catalogued blue-target +50 when no dice were rolled', () => {
  let s = state('hBP04-059', blueTarget.number);
  fund(s.players[0].zones.center, ['紫','無色','無色']);
  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 170);
});

test('061 Arts applies its catalogued green-target +50 with no other eligible 2nd ID2 on stage', () => {
  let s = state('hBP04-061', greenTarget.number);
  fund(s.players[0].zones.center, ['紫','無色']);
  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 130);
});
