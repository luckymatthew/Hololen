import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {cards,pool,state,fund,attack} from './fixtures/simulator-audit.mjs';

const engineUrl = process.env.HOLO_ENGINE_PATH
  ? pathToFileURL(resolve(process.env.HOLO_ENGINE_PATH))
  : new URL('../lib/simulator/engine.mjs', import.meta.url);
const {applyAction} = await import(engineUrl);
const greenTarget = {...cards.find(entry => entry.group === 'holomem' && entry.colors?.includes('綠')), number:'AUDIT-GREEN-TARGET', hp:10000};
const whiteTarget = {...cards.find(entry => entry.group === 'holomem' && entry.colors?.includes('白')), number:'AUDIT-WHITE-TARGET', hp:10000};
const testPool = [...pool, greenTarget, whiteTarget];

test('066 Arts applies its green-target +50 with zero opposing Archive Cheer', () => {
  let s = state('hBP04-066', greenTarget.number);
  fund(s.players[0].zones.center, ['紫','無色']);
  s = applyAction(s, 0, attack, testPool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 130);
});

test('066 Arts adds exactly 10 per opposing Archive Cheer', () => {
  let s = state('hBP04-066', greenTarget.number);
  s.players[1].archive.push({number:'hY01-001',id:'archive-cheer-1'},{number:'hY02-001',id:'archive-cheer-2'});
  fund(s.players[0].zones.center, ['紫','無色']);
  s = applyAction(s, 0, attack, testPool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 150);
});

test('072 Arts counts both stages up to eight and applies its white-target +50', () => {
  let s = state('hBP04-072', whiteTarget.number);
  fund(s.players[0].zones.center, ['黃','黃','無色','藍','紫','綠','紅','白','黃','藍']);
  s = applyAction(s, 0, attack, testPool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 230);
});
