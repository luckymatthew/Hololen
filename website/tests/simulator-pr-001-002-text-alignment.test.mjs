import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  applyAction as websiteApplyAction,
  isActionCandidateLegal as websiteIsActionCandidateLegal,
} from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, attack } from './fixtures/simulator-audit.mjs';

const runtimes = [{
  name: 'Website', applyAction: websiteApplyAction,
  isActionCandidateLegal: websiteIsActionCandidateLegal, cards: websiteCards,
}];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const cards = JSON.parse(readFileSync(androidCardsUrl, 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, isActionCandidateLegal: engine.isActionCandidateLegal, cards });
}
for (const runtime of runtimes) runtime.pool = [...runtime.cards, dummy, oshi];

const choose = (runtime, s, action) => runtime.applyAction(s, 0, { type: 'choose', ...action }, runtime.pool, () => 0);

for (const runtime of runtimes) {
  const { applyAction, isActionCandidateLegal, cards, pool } = runtime;

  test(`${runtime.name}: hPR-001 Spot is played without Bloom and its Arts remain 10`, () => {
    const debut = cards.find(card => card.group === 'holomem' && card.stage === 'Debut' && card.jpName === 'さくらみこ');
    assert.ok(debut, 'catalog must contain the Debut Sakura Miko used to distinguish play from Bloom');
    let s = state();
    s.phase = 'main';
    s.players[0].zones.center = unit(debut.number);
    s.players[0].hand = [inst('hPR-001', 'spot-miko')];
    assert.equal(isActionCandidateLegal(s, 0, { type: 'play', cardId: 'spot-miko' }, pool), true);
    s = applyAction(s, 0, { type: 'play', cardId: 'spot-miko' }, pool, () => 0);
    assert.equal(s.pendingChoice?.type, 'playHolomen', 'Spot enters an empty Back slot; it is not offered as a Bloom');
    assert.deepEqual(s.pendingChoice.options, ['back1', 'back2', 'back3', 'back4', 'back5']);
    s = choose(runtime, s, { zone: 'back1' });
    assert.equal(s.players[0].zones.back1.stack.at(-1).number, 'hPR-001');

    let arts = state('hPR-001');
    arts.players[0].zones.center.cheer = [inst('hY01-001', 'colorless-cost')];
    arts = applyAction(arts, 0, attack, pool, () => 0);
    assert.equal(arts.players[1].zones.center.damage, 10, 'the printed one-colorless Arts deals 10');
  });

  test(`${runtime.name}: hPR-001 Collab offers an optional roll; only 1/3/5 selects Red/Blue Cheer for Back`, () => {
    const runRoll = (die) => {
      let s = state();
      s.phase = 'main';
      s.players[0].zones.back1 = unit('hPR-001');
      s.players[0].zones.back2 = unit('AUDIT-DUMMY');
      s.players[0].cheerDeck = [
        inst('hY03-001', 'red-cheer'),
        inst('hY04-001', 'blue-cheer'),
        inst('hY06-001', 'yellow-cheer'),
      ];
      s.players[0].modifiers = [{ kind: 'dieOverride', amount: die, expiresTurn: s.turn }];
      s = applyAction(s, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
      assert.equal(s.pendingChoice?.effect, 'promoFlowerRoll');
      assert.equal(s.pendingChoice.optional, true);
      return choose(runtime, s, { optionId: 'roll' });
    };

    let success = runRoll(5);
    assert.equal(success.pendingChoice?.effect, 'genericCheerDeckPick');
    assert.deepEqual(new Set(success.pendingChoice.selectableIds), new Set(['red-cheer', 'blue-cheer']));
    success = choose(runtime, success, { cardIds: ['blue-cheer'] });
    assert.equal(success.pendingChoice?.type, 'eventCheerTarget');
    assert.deepEqual(success.pendingChoice.options, ['back2'], 'the Cheer target is restricted to own Back');
    assert.equal(success.pendingChoice.shuffleAfter, true);
    success = choose(runtime, success, { zone: 'back2' });
    assert.ok(success.players[0].zones.back2.cheer.some(card => card.id === 'blue-cheer'));
    assert.deepEqual(new Set(success.players[0].cheerDeck.map(card => card.id)), new Set(['red-cheer', 'yellow-cheer']));

    const miss = runRoll(2);
    assert.equal(miss.pendingChoice, null, 'even results do not run the Cheer selection');
    assert.deepEqual(miss.players[0].cheerDeck.map(card => card.id), ['red-cheer', 'blue-cheer', 'yellow-cheer']);
  });

  test(`${runtime.name}: hPR-002 enforces the six-card hand limit, looks at four, filters ReGLOSS, then bottoms the rest in chosen order`, () => {
    const regloss = cards.filter(card => card.group === 'holomem' && card.tags.includes('#ReGLOSS')).slice(0, 2);
    assert.equal(regloss.length, 2);
    const nonRegloss = cards.find(card => card.group === 'holomem' && !card.tags.includes('#ReGLOSS'));
    assert.ok(nonRegloss);
    const makeState = (otherHandCount) => {
      const s = state();
      s.phase = 'main';
      s.players[0].hand = [inst('hPR-002', 'regloss-event'), ...Array.from({ length: otherHandCount }, (_, i) => inst('AUDIT-DUMMY', `extra-${i}`))];
      s.players[0].mainDeck = [
        inst(regloss[0].number, 'regloss-1'),
        inst(nonRegloss.number, 'not-regloss'),
        inst(regloss[1].number, 'regloss-2'),
        inst('AUDIT-DUMMY', 'bottom-last'),
      ];
      return s;
    };

    const atLimit = makeState(6);
    assert.equal(isActionCandidateLegal(atLimit, 0, { type: 'play', cardId: 'regloss-event' }, pool), true);
    let s = applyAction(atLimit, 0, { type: 'play', cardId: 'regloss-event' }, pool, () => 0);
    assert.equal(s.pendingChoice?.effect, 'topLookToHand');
    assert.equal(s.pendingChoice.cards.length, 4);
    assert.deepEqual(new Set(s.pendingChoice.selectableIds), new Set(['regloss-1', 'regloss-2']));
    assert.equal(s.pendingChoice.min, 0, 'the text permits revealing any number, including none');
    s = choose(runtime, s, { cardIds: ['regloss-2', 'regloss-1'] });
    assert.equal(s.pendingChoice?.effect, 'bottomOrder');
    assert.deepEqual(new Set(s.pendingChoice.cards.map(card => card.id)), new Set(['not-regloss', 'bottom-last']));
    s = choose(runtime, s, { cardIds: ['bottom-last', 'not-regloss'] });
    assert.deepEqual(s.players[0].hand.slice(-2).map(card => card.id), ['regloss-2', 'regloss-1']);
    assert.deepEqual(s.players[0].mainDeck.map(card => card.id), ['bottom-last', 'not-regloss']);
    assert.equal(s.players[0].limitedUsesCount, 1);

    const limitedAgain = state();
    limitedAgain.phase = 'main';
    limitedAgain.players[0].limitedTurn = limitedAgain.turn;
    limitedAgain.players[0].limitedUsesCount = 1;
    limitedAgain.players[0].hand = [inst('hPR-002', 'second-regloss-event')];
    assert.equal(isActionCandidateLegal(limitedAgain, 0, { type: 'play', cardId: 'second-regloss-event' }, pool), false);
    assert.throws(() => applyAction(limitedAgain, 0, { type: 'play', cardId: 'second-regloss-event' }, pool, () => 0), /最多只可使用/u);

    const overLimit = makeState(7);
    assert.equal(isActionCandidateLegal(overLimit, 0, { type: 'play', cardId: 'regloss-event' }, pool), false,
      'the legal-action filter must mirror the printed hand gate');
    assert.throws(() => applyAction(overLimit, 0, { type: 'play', cardId: 'regloss-event' }, pool, () => 0), /不可多於 6 張/u);
  });
}
