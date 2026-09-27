import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  applyAction as websiteApplyAction,
  isActionCandidateLegal as websiteIsActionCandidateLegal,
} from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, attack } from './fixtures/simulator-audit.mjs';

const summerTick = {
  number: 'AUDIT-SUMMER-TICK', name: 'Summer audit tick', jpName: 'Summer audit tick', group: 'holomem',
  stage: 'Debut', hp: 10000, colors: [], tags: ['#サマー'], maxCopies: 4,
  arts: [{ name: 'Tick', damage: 10, cost: [], effect: '' }],
};
const runtimes = [{
  name: 'Website',
  applyAction: websiteApplyAction,
  isActionCandidateLegal: websiteIsActionCandidateLegal,
  cards: websiteCards,
}];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const androidEngine = await import(androidEngineUrl.href);
  const androidCards = JSON.parse(readFileSync(androidCardsUrl, 'utf8')).cards;
  runtimes.push({
    name: 'Android source',
    applyAction: androidEngine.applyAction,
    isActionCandidateLegal: androidEngine.isActionCandidateLegal,
    cards: androidCards,
  });
}
for (const runtime of runtimes) runtime.pool = [...runtime.cards, dummy, oshi, summerTick];

const play = (runtime, s, number, id = number) => runtime.applyAction(s, 0, { type: 'play', cardId: id }, runtime.pool, () => 0);
const select = (runtime, s, action) => runtime.applyAction(s, 0, { type: 'choose', ...action }, runtime.pool, () => 0);

for (const runtime of runtimes) {
  const { applyAction, isActionCandidateLegal, cards, pool } = runtime;

  test(`${runtime.name}: hEB01-031 only attaches an archived Cheer to a #サマー Holomen`, () => {
    let s = state();
    s.phase = 'main';
    s.players[0].zones.center = unit('AUDIT-SUMMER-TICK');
    s.players[0].zones.back1 = unit('AUDIT-DUMMY');
    s.players[0].archive = [inst('hY01-001', 'archived-cheer')];
    s.players[0].hand = [inst('hEB01-031', 'water-play')];

    s = play(runtime, s, 'hEB01-031', 'water-play');
    assert.equal(s.pendingChoice?.effect, 'archiveCheerToStage');
    assert.deepEqual(s.pendingChoice.selectableIds, ['archived-cheer']);
    s = select(runtime, s, { cardIds: ['archived-cheer'] });
    assert.equal(s.pendingChoice?.type, 'stageTarget');
    assert.deepEqual(s.pendingChoice.options, ['center']);
    s = select(runtime, s, { zone: 'center' });
    assert.ok(s.players[0].zones.center.cheer.some(card => card.id === 'archived-cheer'));
    assert.equal(s.players[0].zones.back1.cheer.length, 0);
  });

  test(`${runtime.name}: hEB01-032 LIMITED exception admits first-player turn one only with Sora and resolves draw then bottom`, () => {
    const sora = cards.find(card => card.group === 'oshi' && card.jpName === 'ときのそら');
    assert.ok(sora);
    const makeFirstTurn = (oshiNumber) => {
      const s = state();
      s.phase = 'main';
      s.firstPlayer = 0;
      s.players[0].turnsTaken = 1;
      s.players[0].oshi = inst(oshiNumber, 'first-turn-oshi');
      s.players[0].hand = [inst('hEB01-032', 'star-star-t')];
      s.players[0].mainDeck = [
        inst('AUDIT-DUMMY', 'draw-1'),
        inst('AUDIT-DUMMY', 'draw-2'),
        inst('AUDIT-DUMMY', 'draw-3'),
        inst('AUDIT-DUMMY', 'deck-tail'),
      ];
      return s;
    };

    const allowed = makeFirstTurn(sora.number);
    assert.equal(isActionCandidateLegal(allowed, 0, { type: 'play', cardId: 'star-star-t' }, pool), true,
      'the printed Sora exception must also be visible to legal-action filtering');
    let s = play(runtime, allowed, 'hEB01-032', 'star-star-t');
    assert.deepEqual(s.players[0].hand.map(card => card.id), ['draw-1', 'draw-2', 'draw-3']);
    assert.equal(s.pendingChoice?.effect, 'handToBottom');
    s = select(runtime, s, { cardIds: ['draw-2'] });
    assert.deepEqual(s.players[0].mainDeck.map(card => card.id), ['deck-tail', 'draw-2']);
    assert.deepEqual(s.players[0].hand.map(card => card.id), ['draw-1', 'draw-3']);
    assert.equal(s.players[0].limitedUsesCount, 1);

    const denied = makeFirstTurn(oshi.number);
    assert.equal(isActionCandidateLegal(denied, 0, { type: 'play', cardId: 'star-star-t' }, pool), false);
    assert.throws(() => play(runtime, denied, 'hEB01-032', 'star-star-t'), /先攻玩家第 1 回合|先攻第 1 回合/u);
  });

  test(`${runtime.name}: hEB01-033 grants Arts +10 only to #サマー and transfers only to a different Summer Center/Collab`, () => {
    let s = state('AUDIT-SUMMER-TICK');
    s.players[0].zones.center.attachments = [inst('hEB01-033', 'beach-ball')];
    s.players[0].zones.collab = unit('AUDIT-SUMMER-TICK');
    s.players[0].zones.back1 = unit('AUDIT-SUMMER-TICK');
    s = applyAction(s, 0, { ...attack, targetZone: 'center' }, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, 20, '10 printed Arts +10 from the #サマー attachment');
    assert.equal(s.pendingChoice?.effect, 'moveAttachment');
    assert.deepEqual(s.pendingChoice.options, ['collab'], 'same source and Back slots are not transfer destinations');
    s = select(runtime, s, { zone: 'collab' });
    assert.equal(s.players[0].zones.center.attachments.some(card => card.id === 'beach-ball'), false);
    assert.ok(s.players[0].zones.collab.attachments.some(card => card.id === 'beach-ball'));

    let nonSummer = state('AUDIT-DUMMY');
    nonSummer.players[0].zones.center.attachments = [inst('hEB01-033', 'non-summer-ball')];
    nonSummer = applyAction(nonSummer, 0, { ...attack, targetZone: 'center' }, pool, () => 0);
    assert.equal(nonSummer.players[1].zones.center.damage, 100, 'non-Summer Holomen do not receive the bonus');
    assert.equal(nonSummer.pendingChoice, null, 'there is no legal Summer Center/Collab destination');
  });

  test(`${runtime.name}: hEB01-034 has its unconditional Arts +10`, () => {
    let s = state('hEB01-021');
    s.players[0].zones.center.attachments = [inst('hEB01-034', 'explainer-tool')];
    s.players[0].zones.center.cheer = [inst('hY01-001', 'arts-cost')];
    s = applyAction(s, 0, attack, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, 40, 'hEB01-021 printed 30 Arts plus the tool’s unconditional 10');
  });

  test(`${runtime.name}: hEB01-034 end-performance special damage uses shared damage modifiers`, () => {
    let s = state('hEB01-024');
    s.players[0].zones.center.attachments = [inst('hEB01-034', 'end-tool')];
    s.players[1].zones.center.attachments = [inst('hBP01-121', 'damage-reducer')];
    s.players[1].zones.back1 = unit('AUDIT-DUMMY');

    s = applyAction(s, 0, { type: 'advance' }, pool, () => 0);
    assert.equal(s.pendingChoice?.type, 'endToolDamage');
    assert.equal(s.pendingChoice.optional, true, 'the effect says it may be used');
    assert.deepEqual(s.pendingChoice.options, ['center']);
    s = select(runtime, s, { zone: 'center' });
    assert.equal(s.players[0].zones.center.attachments.some(card => card.id === 'end-tool'), false);
    assert.ok(s.players[0].archive.some(card => card.id === 'end-tool'));
    assert.equal(s.players[1].zones.center.damage, 20,
      'Kotori reduces this 30-point special-damage effect by 10 through the common resolver');

    let declined = state('hEB01-024');
    declined.players[0].zones.center.attachments = [inst('hEB01-034', 'declined-tool')];
    declined = applyAction(declined, 0, { type: 'advance' }, pool, () => 0);
    assert.equal(declined.pendingChoice?.optional, true);
    declined = select(runtime, declined, { skip: true });
    assert.ok(declined.players[0].zones.center.attachments.some(card => card.id === 'declined-tool'));
    assert.equal(declined.players[1].zones.center.damage, 0);

    let backRow = state('hEB01-024');
    backRow.players[0].zones.center = unit('AUDIT-DUMMY');
    backRow.players[0].zones.back1 = unit('hEB01-024', { attachments: [inst('hEB01-034', 'back-row-tool')] });
    backRow = applyAction(backRow, 0, { type: 'advance' }, pool, () => 0);
    assert.notEqual(backRow.pendingChoice?.type, 'endToolDamage', 'the added effect is limited to Center or Collab');
  });
}
