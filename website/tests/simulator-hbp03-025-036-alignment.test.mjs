import test from 'node:test';
import assert from 'node:assert/strict';
import { cards, pool, state, unit, inst, fund, attack } from './fixtures/simulator-audit.mjs';
const engineModule = await import(process.env.HOLO_ENGINE_TEST_TARGET || '../lib/simulator/engine.mjs');
const { applyAction } = engineModule;

const greenTarget = { number: 'AUDIT-GREEN-TARGET', name: 'Audit Green Target', jpName: 'Audit Green Target', group: 'holomem', typeCode: 'character', stage: '2nd', hp: 10000, colors: ['綠'], tags: [], arts: [] };
pool.push(greenTarget);

test('hBP03-030 counts attached 35P and applies its green-target +50', () => {
  const art = cards.find((card) => card.number === 'hBP03-030').arts[0];
  for (const [count, expected] of [[0, 170], [1, 190], [2, 210]]) {
    const source = unit('hBP03-030', { attachments: Array.from({ length: count }, (_, index) => inst('hBP03-107', `miko-35p-${index}`)) });
    fund(source, art.cost);
    const game = state('hBP03-030', greenTarget.number);
    game.players[0].zones.center = source;
    game.players[1].zones.center = unit(greenTarget.number);
    const result = applyAction(structuredClone(game), 0, attack, pool, () => 0);
    assert.equal(result.players[1].zones.center.damage, expected);
  }
});

test('hBP03-030 Gift is Center-only, requires 35P, and adds +50 only on 3 or 5', () => {
  const art = cards.find((card) => card.number === 'hBP03-030').arts[0];
  for (const [face, expected] of [[1, 190], [3, 240], [5, 240], [6, 190]]) {
    const source = unit('hBP03-030', { attachments: [inst('hBP03-107', 'gift-35p')] });
    fund(source, art.cost);
    const game = state('hBP03-030', greenTarget.number);
    game.phase = 'main';
    game.players[0].zones.center = source;
    game.players[1].zones.center = unit(greenTarget.number);
    let result = applyAction(structuredClone(game), 0, { type: 'giftSkill', zone: 'center' }, pool, () => (face - 0.5) / 6);
    assert.throws(() => applyAction(structuredClone(result), 0, { type: 'giftSkill', zone: 'center' }, pool, () => 0));
    result.phase = 'performance';
    result = applyAction(result, 0, attack, pool, () => 0);
    assert.equal(result.players[1].zones.center.damage, expected);
  }
});

test('hBP03-023 Pekora Collab search is required on an even roll and enables its own Arts bonus', () => {
  const art = cards.find((card) => card.number === 'hBP03-023').arts[0];
  const game = state('hBP03-023');
  game.phase = 'main';
  game.players[0].zones.center = unit('hBP03-023');
  game.players[0].zones.back1 = unit('hBP03-023');
  fund(game.players[0].zones.center, art.cost);
  game.players[0].mainDeck = [inst('AUDIT-DUMMY', 'collab-draw'), inst('hBP03-107', 'fan-search'), inst('AUDIT-DUMMY', 'tail')];
  let result = applyAction(game, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
  assert.equal(result.pendingChoice.effect, 'pekoraFanSearchRoll');
  result = applyAction(result, 0, { type: 'choose', optionId: 'roll' }, pool, () => 0.25);
  assert.equal(result.pendingChoice.optional, false);
  assert.equal(result.pendingChoice.nonEmptyMin, 1);
  assert.throws(() => applyAction(structuredClone(result), 0, { type: 'choose', skip: true }, pool, () => 0));
  result = applyAction(result, 0, { type: 'choose', cardIds: ['fan-search'] }, pool, () => 0);
  result.phase = 'performance';
  result = applyAction(result, 0, attack, pool, () => 0);
  assert.equal(result.players[1].zones.center.damage, art.damage + 40);
});
