import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {cards,pool,state,fund,attack} from './fixtures/simulator-audit.mjs';

const engineUrl = process.env.HOLO_ENGINE_PATH
  ? pathToFileURL(resolve(process.env.HOLO_ENGINE_PATH))
  : new URL('../lib/simulator/engine.mjs', import.meta.url);
const {applyAction} = await import(engineUrl);

test('hBP05-010 gains its printed +30 Arts after using Gyudon this turn', () => {
  const gyudon = cards.find(card => card.jpName === '牛丼');
  assert.ok(gyudon, 'catalog must contain the named Gyudon support');
  const s = state('hBP05-010');
  fund(s.players[0].zones.center, ['無色', '無色']);
  s.players[0].turnEvents = {turn: s.turn, arts: [], supports: [gyudon.number]};

  const result = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(result.players[1].zones.center.damage, 50, 'printed 20 Arts receives the conditional +30');
});
