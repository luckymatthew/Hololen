import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cards, pool, state, unit, inst, fund, attack } from './fixtures/simulator-audit.mjs';

const engineUrl = process.env.HOLO_ENGINE_PATH
  ? pathToFileURL(resolve(process.env.HOLO_ENGINE_PATH))
  : new URL('../lib/simulator/engine.mjs', import.meta.url);
const { applyAction } = await import(engineUrl);

const koTarget = {
  ...pool.find(card => card.number === 'AUDIT-DUMMY'),
  number: 'HBP05-GIFT-TARGET',
  stage: 'Debut',
  hp: 50,
  tags: [],
};
const giftPool = [...pool, koTarget];
const id1Debut = cards.find(card => card.group === 'holomem' && card.stage === 'Debut' && card.tags.includes('#ID1期生'));

function giftState(withTarget) {
  const s = state('hBP05-023', koTarget.number);
  fund(s.players[0].zones.center, ['綠', '無色', '無色']);
  s.players[0].archive = [inst('hY01-001', 'archive-cheer')];
  s.players[1].zones.center = unit(koTarget.number, { damage: 40 });
  if (withTarget) s.players[0].zones.back1 = unit(id1Debut.number);
  return s;
}

test('Iofi knockout Gift remains optional and can attach the selected Cheer to an eligible #ID1 recipient', () => {
  let next = applyAction(giftState(true), 0, attack, giftPool, () => 0);
  assert.equal(next.pendingChoice?.effect, 'archiveCheerToStage');
  assert.equal(next.pendingChoice?.optional, true);
  next = applyAction(next, 0, { type: 'choose', cardIds: ['archive-cheer'] }, giftPool, () => 0);
  assert.deepEqual(next.pendingChoice?.options, ['center', 'back1']);
  next = applyAction(next, 0, { type: 'choose', zone: 'back1' }, giftPool, () => 0);
  assert.ok(next.players[0].zones.back1.cheer.some(card => card.id === 'archive-cheer'));
  assert.equal(next.players[0].archive.some(card => card.id === 'archive-cheer'), false);
});
