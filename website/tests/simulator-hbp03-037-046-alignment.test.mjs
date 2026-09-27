import test from 'node:test';
import assert from 'node:assert/strict';
import { cards, pool, state, unit, inst, fund, attack } from './fixtures/simulator-audit.mjs';
const engineModule = await import(process.env.HOLO_ENGINE_TEST_TARGET || '../lib/simulator/engine.mjs');
const { applyAction } = engineModule;

const purpleTarget = { number: 'AUDIT-PURPLE-TARGET', name: 'Audit Purple Target', jpName: 'Audit Purple Target', group: 'holomem', typeCode: 'character', stage: '2nd', hp: 10000, colors: ['紫'], tags: [], arts: [] };
pool.push(purpleTarget);

function useArt(artIndex) {
  const card = cards.find((entry) => entry.number === 'hBP03-043');
  const source = unit('hBP03-043');
  fund(source, card.arts[artIndex].cost);
  const game = state('hBP03-043', purpleTarget.number);
  game.players[0].zones.center = source;
  game.players[1].zones.center = unit(purpleTarget.number);
  if (artIndex === 1) {
    game.players[0].oshi = inst(cards.find((entry) => entry.group === 'oshi' && entry.jpName === 'FUWAMOCO').number);
    game.players[0].zones.back1 = unit('hBP03-037');
  }
  let result = applyAction(structuredClone(game), 0, { ...attack, artIndex }, pool, () => 0);
  if (artIndex === 1) {
    assert.equal(result.pendingChoice.effect, 'genericMoveCheer');
    result = applyAction(result, 0, { type: 'choose', skip: true }, pool, () => 0);
  }
  return result.players[1].zones.center.damage;
}

test('hBP03-043 Arts 0 applies its catalogued purple-target +50', () => {
  assert.equal(useArt(0), cards.find((entry) => entry.number === 'hBP03-043').arts[0].damage + 50);
});

test('hBP03-043 Arts 1 applies its catalogued purple-target +50 after skipping Cheer transfer', () => {
  assert.equal(useArt(1), cards.find((entry) => entry.number === 'hBP03-043').arts[1].damage + 50);
});

test('hBP03-037 removes one Colorless Arts cost only while own Center is Fuwawa', () => {
  const game = state('hBP03-037');
  game.players[0].zones.center = unit('hBP03-040');
  game.players[0].zones.collab = unit('hBP03-037');
  let result = applyAction(structuredClone(game), 0, { ...attack, sourceZone: 'collab' }, pool, () => 0);
  assert.equal(result.players[1].zones.center.damage, cards.find((entry) => entry.number === 'hBP03-037').arts[0].damage);

  const noFuwawa = state('hBP03-037');
  noFuwawa.players[0].zones.center = unit('AUDIT-DUMMY');
  noFuwawa.players[0].zones.collab = unit('hBP03-037');
  assert.throws(() => applyAction(noFuwawa, 0, { ...attack, sourceZone: 'collab' }, pool, () => 0));
});
