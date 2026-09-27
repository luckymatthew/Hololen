import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  applyAction as websiteApplyAction,
  isActionCandidateLegal as websiteIsActionCandidateLegal,
} from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, fund } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, isActionCandidateLegal: websiteIsActionCandidateLegal, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const catalog = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, isActionCandidateLegal: engine.isActionCandidateLegal, cards: catalog });
}

for (const runtime of runtimes) {
  const { applyAction, isActionCandidateLegal, cards } = runtime;
  const pool = [...cards, dummy, oshi];
  const card = number => cards.find(candidate => candidate.number === number);
  const act = (battle, action, playerIndex = 0, random = () => 0) => applyAction(battle, playerIndex, action, pool, random);
  const choose = (battle, action, playerIndex = 0, random = () => 0) => act(battle, { type: 'choose', ...action }, playerIndex, random);
  const main = (source = 'hSD14-002') => { const battle = state(source, 'hSD14-003'); battle.phase = 'main'; return battle; };

  test(`${runtime.name}: hSD14-001 normal Oshi selects only own Fubuki with a mascot, adds +20 Arts, and costs two Holo Power`, () => {
    let battle = main();
    battle.players[0].oshi = inst('hSD14-001', 'fubuki-oshi');
    battle.players[0].holoPower = [inst(dummy.number, 'normal-power-1'), inst(dummy.number, 'normal-power-2')];
    battle.players[0].zones.center = unit('hSD14-002', { attachments: [inst('hSD14-011', 'center-mascot')] });
    battle.players[0].zones.back1 = unit('hSD14-003');
    battle.players[1].zones.center = unit('hSD14-002', { attachments: [inst('hSD14-011', 'opponent-mascot')] });

    battle = act(battle, { type: 'oshiSkill' });
    assert.deepEqual(battle.pendingChoice?.options, ['center'], 'only the own eligible Fubuki is selectable');
    assert.equal(battle.players[0].holoPower.length, 0);
    battle = choose(battle, { zone: 'center' });
    assert.deepEqual([battle.players[0].zones.center.modifiers.at(-1).kind, battle.players[0].zones.center.modifiers.at(-1).amount], ['arts', 20]);
    assert.equal(battle.players[0].zones.center.modifiers.at(-1).expiresTurn, battle.turn);
    assert.equal(isActionCandidateLegal(battle, 0, { type: 'oshiSkill' }, pool), false, 'the normal skill is once per turn');
  });

  test(`${runtime.name}: hSD14-001 cannot pay or activate its targeted normal skill without an own Fubuki carrying a mascot`, () => {
    const battle = main();
    battle.players[0].oshi = inst('hSD14-001', 'fubuki-oshi-no-target');
    battle.players[0].holoPower = [inst(dummy.number, 'no-target-power-1'), inst(dummy.number, 'no-target-power-2')];
    battle.players[0].zones.center = unit('hSD14-002');
    battle.players[1].zones.center = unit('hSD14-002', { attachments: [inst('hSD14-011', 'opponent-only-mascot')] });

    assert.equal(isActionCandidateLegal(battle, 0, { type: 'oshiSkill' }, pool), false, 'the printed target requirement must gate the action candidate');
    assert.throws(() => act(battle, { type: 'oshiSkill' }), /沒有附著吉祥物的白上フブキ/u);
    assert.equal(battle.players[0].holoPower.length, 2, 'failed activation cannot consume its cost');
    assert.equal(battle.players[0].oshiSkillTurn, undefined);
    assert.equal(battle.pendingChoice, null);
  });

  test(`${runtime.name}: hSD14-001 SP takes one to two mascot cards from the deck, shuffles, and is once per game`, () => {
    let battle = main();
    battle.players[0].oshi = inst('hSD14-001', 'fubuki-oshi-sp');
    battle.players[0].holoPower = [inst(dummy.number, 'sp-power-1'), inst(dummy.number, 'sp-power-2')];
    battle.players[0].mainDeck = [inst('hSD14-002', 'sp-nonmascot'), inst('hSD14-011', 'sp-mascot-1'), inst('hSD14-011', 'sp-mascot-2'), inst('hSD14-003', 'sp-tail')];

    battle = act(battle, { type: 'spOshiSkill' });
    assert.equal(battle.pendingChoice?.effect, 'deckToHandShuffle');
    assert.equal(battle.pendingChoice.min, 0, 'hidden-deck search keeps the fail-to-find option');
    assert.equal(battle.pendingChoice.nonEmptyMin, 1);
    assert.equal(battle.pendingChoice.max, 2);
    assert.deepEqual(new Set(battle.pendingChoice.cards.map(item => item.id)), new Set(['sp-mascot-1', 'sp-mascot-2']));
    battle = choose(battle, { cardIds: ['sp-mascot-1', 'sp-mascot-2'] });
    assert.deepEqual(new Set(battle.players[0].hand.map(item => item.id)), new Set(['sp-mascot-1', 'sp-mascot-2']));
    assert.equal(battle.players[0].mainDeck.some(item => item.id === 'sp-nonmascot'), true);
    assert.equal(battle.players[0].spOshiSkillUsed, true);
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.equal(isActionCandidateLegal(battle, 0, { type: 'spOshiSkill' }, pool), false);
  });

  test(`${runtime.name}: hSD14-001 SP may fail to find a hidden mascot and still completes the search`, () => {
    let battle = main();
    battle.players[0].oshi = inst('hSD14-001', 'fubuki-oshi-sp-empty');
    battle.players[0].holoPower = [inst(dummy.number, 'sp-empty-power-1'), inst(dummy.number, 'sp-empty-power-2')];
    battle.players[0].mainDeck = [inst('hSD14-002', 'sp-no-mascot-1'), inst('hSD14-003', 'sp-no-mascot-2')];
    let randomCalls = 0;

    battle = act(battle, { type: 'spOshiSkill' }, 0, () => { randomCalls += 1; return 0.4; });
    assert.equal(battle.pendingChoice, null, 'there is no matching card to select');
    assert.ok(randomCalls > 0, 'the empty search still shuffles the deck');
    assert.equal(battle.players[0].mainDeck.length, 2);
    assert.equal(battle.players[0].spOshiSkillUsed, true);
  });

  test(`${runtime.name}: hSD14-004 Collab searches one mascot only on the second player's first turn`, () => {
    const fixture = (firstPlayer, turnsTaken) => {
      const battle = main();
      battle.firstPlayer = firstPlayer;
      battle.turn = firstPlayer === 0 && turnsTaken === 1 ? 1 : turnsTaken === 1 ? 2 : 4;
      battle.players[0].turnsTaken = turnsTaken;
      battle.players[1].turnsTaken = firstPlayer === 1 && turnsTaken === 1 ? 1 : 2;
      battle.players[0].zones.back1 = unit('hSD14-004');
      battle.players[0].mainDeck = [inst('hSD14-002', `ordinary-collab-${firstPlayer}-${turnsTaken}`), inst('hSD14-011', `mascot-${firstPlayer}-${turnsTaken}`), inst('hSD14-003', `tail-${firstPlayer}-${turnsTaken}`)];
      return battle;
    };

    let secondFirstTurn = fixture(1, 1);
    secondFirstTurn = act(secondFirstTurn, { type: 'collab', zone: 'back1' });
    assert.equal(secondFirstTurn.pendingChoice?.effect, 'deckToHandShuffle');
    assert.equal(secondFirstTurn.pendingChoice.min, 0);
    assert.equal(secondFirstTurn.pendingChoice.nonEmptyMin, 1);
    assert.deepEqual(secondFirstTurn.pendingChoice.cards.map(item => item.number), ['hSD14-011']);
    secondFirstTurn = choose(secondFirstTurn, { cardIds: [secondFirstTurn.pendingChoice.cards[0].id] });
    assert.equal(secondFirstTurn.players[0].hand[0].number, 'hSD14-011');
    assert.equal(secondFirstTurn.players[0].holoPower[0].number, 'hSD14-002', 'ordinary Collab power resolves separately before the search');

    for (const [firstPlayer, turnsTaken] of [[0, 1], [1, 2]]) {
      const noTrigger = fixture(firstPlayer, turnsTaken);
      const result = act(noTrigger, { type: 'collab', zone: 'back1' });
      assert.equal(result.pendingChoice, null, `firstPlayer=${firstPlayer}, turnsTaken=${turnsTaken}`);
      assert.equal(result.players[0].hand.length, 0);
    }
  });

  test(`${runtime.name}: hSD14-005 Collab adds +10 only to own Center Arts for the turn`, () => {
    let battle = main();
    battle.players[0].zones.center = unit('hSD14-002');
    battle.players[0].zones.back1 = unit('hSD14-005');
    battle = act(battle, { type: 'collab', zone: 'back1' });
    assert.deepEqual([battle.players[0].zones.center.modifiers.at(-1).kind, battle.players[0].zones.center.modifiers.at(-1).amount], ['arts', 10]);
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, card('hSD14-002').arts[0].cost);
    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(battle.players[1].zones.center.damage, 30, 'printed 20 Arts plus the one-turn +10 modifier');
  });

  test(`${runtime.name}: hSD14-002/003/006 basic Arts use their printed damage and Cheer costs`, () => {
    const cases = [
      ['hSD14-002', 0, 20, ['無色']],
      ['hSD14-003', 0, 30, ['白']],
      ['hSD14-006', 0, 30, ['無色']],
      ['hSD14-006', 1, 50, ['白', '無色']],
    ];
    for (const [number, artIndex, damage, cost] of cases) {
      assert.deepEqual([card(number).arts[artIndex].damage, card(number).arts[artIndex].cost], [damage, cost]);
      let battle = state(number, 'hSD14-003');
      battle.phase = 'performance';
      fund(battle.players[0].zones.center, cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex });
      assert.equal(battle.players[1].zones.center.damage, damage, `${number} Arts ${artIndex + 1}`);
    }
  });
}
