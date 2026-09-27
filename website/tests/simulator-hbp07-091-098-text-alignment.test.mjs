import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { pool, inst, unit, state } from './fixtures/simulator-audit.mjs';

const act = (s, playerIndex, action, random = () => 0) => applyAction(s, playerIndex, action, pool, random);
const play = (s, cardId, random = () => 0) => act(s, 0, { type: 'play', cardId }, random);

test('hBP07-092 returns 1–3 archived Holomen, shuffles, then draws two', () => {
  let s = state('hBP07-091');
  s.phase = 'main';
  s.players[0].hand = [inst('hBP07-092', 'event')];
  s.players[0].archive = [inst('hBP07-083', 'holomem-a'), inst('hBP07-085', 'holomem-b'), inst('hBP07-090', 'holomem-c'), inst('hBP07-091', 'support')];
  s.players[0].mainDeck = [inst('hBP07-035', 'draw-a'), inst('hBP07-036', 'draw-b'), inst('hBP07-037', 'draw-c')];

  s = play(s, 'event');
  assert.equal(s.pendingChoice.effect, 'archiveHolomemToDeckDraw');
  assert.equal(s.pendingChoice.min, 1);
  assert.equal(s.pendingChoice.max, 3);
  assert.ok(s.pendingChoice.cards.every((card) => pool.find((definition) => definition.number === card.number)?.group === 'holomem'));
  s = act(s, 0, { type: 'choose', cardIds: ['holomem-a', 'holomem-c'] });

  assert.equal(s.players[0].hand.length, 2);
  assert.equal(s.players[0].mainDeck.length, 3);
  assert.ok(!s.players[0].archive.some((card) => ['holomem-a', 'holomem-c'].includes(card.id)));
  assert.ok(s.players[0].archive.some((card) => card.id === 'holomem-b'));
  assert.ok(s.players[0].archive.some((card) => card.id === 'support'));
});

for (const [dice, expectedArchive] of [[() => 0, false], [() => 0.999, true]]) {
  test(`hBP07-093 buffs Collab Zeta, then keeps or shuffles back by die (${expectedArchive ? '6' : 'not 6'})`, () => {
    let s = state('hBP07-091');
    s.phase = 'main';
    s.players[0].hand = [inst('hBP07-093', 'event-1'), inst('hBP07-093', 'event-2')];
    s.players[0].zones.collab = unit('hBP01-024');
    s = play(s, 'event-1', dice);

    assert.ok(s.players[0].zones.collab.modifiers.some((modifier) => modifier.kind === 'arts' && modifier.amount === 40 && modifier.expiresTurn === s.turn));
    assert.equal(s.players[0].archive.some((card) => card.id === 'event-1'), expectedArchive);
    assert.equal(s.players[0].mainDeck.some((card) => card.id === 'event-1'), !expectedArchive);
    assert.throws(() => play(s, 'event-2', dice), /本回合已使用過/u);
  });
}

for (const [lifeCount, shouldAffectOpponent] of [[4, false], [3, true]]) {
  test(`hBP07-094 hand reset branches at three Life (${lifeCount})`, () => {
    let s = state('hBP07-091');
    s.phase = 'main';
    s.players[0].life.length = lifeCount;
    s.players[0].hand = [inst('hBP07-094', 'event'), ...Array.from({ length: 5 }, (_, index) => inst('hBP07-035', `own-${index}`))];
    s.players[1].hand = [inst('hBP07-036', 'opp-a'), inst('hBP07-037', 'opp-b')];
    s = play(s, 'event');

    assert.equal(s.players[0].hand.length, 4);
    assert.equal(s.players[1].hand.length, shouldAffectOpponent ? 4 : 2);
    assert.ok(s.players[0].archive.some((card) => card.id === 'event'));
    assert.equal(s.players[0].limitedUsesCount, 1);
  });
}

for (const [ownRoll, opponentRoll, wins] of [[0.999, 0, true], [0.5, 0.5, true], [0, 0.999, false]]) {
  test(`hBP07-095 compares both dice and resolves the matching result (${wins ? 'buff' : 'Cheer'})`, () => {
    let s = state('hBP07-091');
    s.phase = 'main';
    s.players[0].hand = [inst('hBP07-095', 'event')];
    s.players[0].zones.center = unit('hBP01-014');
    s.players[1].zones.center = unit('hBP01-014');
    s.players[0].cheerDeck = [inst('hY06-001', 'top-cheer')];
    const rolls = [ownRoll, opponentRoll];
    let rollIndex = 0;
    s = play(s, 'event', () => rolls[rollIndex++]);

    if (wins) {
      assert.ok(s.players[0].zones.center.modifiers.some((modifier) => modifier.kind === 'arts' && modifier.amount === 100));
      assert.equal(s.pendingChoice, null);
    } else {
      assert.equal(s.pendingChoice.type, 'eventCheerTarget');
      s = act(s, 0, { type: 'choose', zone: 'center' });
      assert.equal(s.players[0].zones.center.cheer[0].id, 'top-cheer');
    }
  });
}

test('hBP07-096 bottoms all selected Haato stack cards in order and discounts every own Haato Arts', () => {
  let s = state('hBP07-036');
  s.phase = 'main';
  s.players[0].hand = [inst('hBP07-096', 'event')];
  s.players[0].zones.back1 = unit('hBP07-037', { stack: [inst('hBP07-035', 'under'), inst('hBP07-037', 'selected-haato')] });
  s = play(s, 'event');
  assert.deepEqual(s.pendingChoice.options, ['back1']);
  s = act(s, 0, { type: 'choose', zone: 'back1' });
  assert.equal(s.pendingChoice.effect, 'stackBottomOrder');
  s = act(s, 0, { type: 'choose', cardIds: ['under', 'selected-haato'] });
  assert.equal(s.players[0].zones.back1, null);
  assert.deepEqual(s.players[0].mainDeck.slice(-2).map((card) => card.id), ['under', 'selected-haato']);
  assert.ok(s.players[0].modifiers.some((modifier) => modifier.kind === 'artCost' && modifier.amount === -1 && modifier.rule?.names?.includes('赤井はあと')));

  s.phase = 'performance';
  s = act(s, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
  assert.equal(s.players[1].zones.center.damage, 30, 'the remaining Haato can use its 1-Colorless Arts without attached Cheer');
});

test('hBP07-097 searches two Promise Holomen then grants +20 only when own Life is lower', () => {
  let s = state('hBP01-017');
  s.phase = 'main';
  s.players[0].life.length = 4;
  s.players[0].hand = [inst('hBP07-097', 'event')];
  s.players[0].mainDeck = [inst('hBP01-015', 'promise-a'), inst('hBP01-016', 'promise-b'), inst('hBP07-035', 'tail')];
  s = play(s, 'event');
  assert.equal(s.pendingChoice.min, 0, 'hidden deck searches use min=0 plus a required non-empty minimum');
  assert.equal(s.pendingChoice.nonEmptyMin, 2);
  assert.equal(s.pendingChoice.max, 2);
  assert.equal(s.pendingChoice.optional, false);
  s = act(s, 0, { type: 'choose', cardIds: ['promise-a', 'promise-b'] });
  assert.equal(s.pendingChoice.effect, 'addModifier');
  assert.deepEqual(s.pendingChoice.options, ['center']);
  s = act(s, 0, { type: 'choose', zone: 'center' });
  assert.equal(s.players[0].zones.center.modifiers.at(-1).amount, 20);
  assert.ok(s.players[0].hand.some((card) => card.id === 'promise-a'));
  assert.ok(s.players[0].hand.some((card) => card.id === 'promise-b'));
});

test('hBP07-098 Mio Oshi adds +20 per revealed Support, then orders all three cards on top', () => {
  let s = state('hBP07-036');
  s.phase = 'main';
  s.players[0].oshi = inst('hBP07-003');
  s.players[0].hand = [inst('hBP07-098', 'event')];
  s.players[0].zones.center.cheer = [inst('hY01-001', 'center-cost')];
  s.players[0].zones.collab = unit('hBP07-037');
  s.players[0].zones.collab.cheer = [inst('hY01-001', 'collab-cost')];
  s.players[0].mainDeck = [inst('hBP07-091', 'support-a'), inst('hBP07-092', 'support-b'), inst('hBP07-035', 'holomem')];
  s = play(s, 'event');
  assert.equal(s.pendingChoice.effect, 'topOrder');
  assert.equal(s.pendingChoice.cards.length, 3);
  assert.ok(s.players[0].modifiers.some((modifier) => modifier.kind === 'arts' && modifier.amount === 40));
  s = act(s, 0, { type: 'choose', cardIds: ['holomem', 'support-a', 'support-b'] });
  assert.deepEqual(s.players[0].mainDeck.slice(0, 3).map((card) => card.id), ['holomem', 'support-a', 'support-b']);

  s.phase = 'performance';
  s = act(s, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
  assert.equal(s.players[1].zones.center.damage, 70);
  s = act(s, 0, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 });
  assert.equal(s.players[1].zones.center.damage, 130, 'the Arts bonus applies to every own stage Holomen');
});
