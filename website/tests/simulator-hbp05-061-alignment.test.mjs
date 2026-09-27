import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cards, pool, state, unit, inst, fund, attack } from './fixtures/simulator-audit.mjs';

const engineUrl = process.env.HOLO_ENGINE_PATH
  ? pathToFileURL(resolve(process.env.HOLO_ENGINE_PATH))
  : new URL('../lib/simulator/engine.mjs', import.meta.url);
const { applyAction } = await import(engineUrl);

test('hBP05-061 distributes each archived-card Arts bonus to one own #歌 Holomen', () => {
  const otherSinger = cards.find(card => card.group === 'holomem'
    && card.tags?.includes('#歌') && card.number !== 'hBP05-061');
  assert.ok(otherSinger, 'fixture catalog needs another #歌 Holomen');

  let s = state('hBP05-061');
  fund(s.players[0].zones.center, ['紫', '無色', '無色']);
  s.players[0].zones.back1 = unit(otherSinger.number);
  s.players[0].hand = [inst('AUDIT-DUMMY', 'pay1'), inst('AUDIT-DUMMY', 'pay2')];

  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.pendingChoice?.effect, 'artHandArchiveCost');
  s = applyAction(s, 0, { type: 'choose', cardIds: ['pay1', 'pay2'] }, pool, () => 0);

  assert.equal(s.pendingChoice?.effect, 'artBuffTarget');
  assert.equal(s.pendingChoice?.meta?.amount, 20);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.pendingChoice?.effect, 'artBuffTarget');
  assert.equal(s.pendingChoice?.meta?.amount, 20);
  s = applyAction(s, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);

  assert.ok(s.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 20));
  assert.ok(s.players[0].zones.back1.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 20));
});
