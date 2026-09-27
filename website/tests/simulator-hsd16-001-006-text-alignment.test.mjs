import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction, isActionCandidateLegal as websiteIsActionCandidateLegal } from '../lib/simulator/engine.mjs';
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
  const main = () => { const battle = state('hSD16-002', 'hSD16-003'); battle.phase = 'main'; return battle; };

  test(`${runtime.name}: hSD16-001 normal Oshi draws one only when own stage has an attached 35P`, () => {
    let battle = main();
    battle.players[0].oshi = inst('hSD16-001', 'miko-normal-oshi');
    battle.players[0].holoPower = [inst(dummy.number, 'miko-normal-power-1'), inst(dummy.number, 'miko-normal-power-2')];
    battle.players[0].zones.back1 = unit('hSD16-002', { attachments: [inst('hBP03-107', 'miko-normal-fan')] });
    battle.players[0].mainDeck = [inst('hSD16-003', 'miko-normal-draw'), inst('hSD16-004', 'miko-normal-tail')];

    battle = act(battle, { type: 'oshiSkill' });
    assert.deepEqual(battle.players[0].hand.map(item => item.id), ['miko-normal-draw']);
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.equal(battle.players[0].oshiSkillTurn, battle.turn);
  });

  test(`${runtime.name}: hSD16-001 SP buffs only an own Sakura Miko with an attached fan`, () => {
    let battle = main();
    battle.players[0].oshi = inst('hSD16-001', 'miko-sp-oshi');
    battle.players[0].holoPower = [inst(dummy.number, 'miko-sp-power-1'), inst(dummy.number, 'miko-sp-power-2')];
    battle.players[0].zones.center = unit('hSD16-002');
    battle.players[0].zones.back1 = unit('hSD16-003', { attachments: [inst('hBP03-107', 'miko-sp-fan')] });
    battle.players[0].zones.back2 = unit('hSD16-004', { attachments: [inst('hSD14-011', 'miko-sp-mascot')] });
    battle.players[1].zones.center = unit('hSD16-002', { attachments: [inst('hBP03-107', 'opponent-miko-fan')] });

    battle = act(battle, { type: 'spOshiSkill' });
    assert.deepEqual(battle.pendingChoice?.options, ['back1']);
    assert.equal(battle.players[0].holoPower.length, 0);
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.players[0].zones.back1.modifiers.at(-1)?.amount, 50);
    assert.equal(battle.players[0].zones.center.modifiers.length, 0);
    assert.equal(battle.players[0].zones.back2.modifiers.length, 0);
    assert.equal(battle.players[0].spOshiSkillUsed, true);
  });

  test(`${runtime.name}: hSD16-001 SP is unavailable without an own fan-equipped Sakura Miko`, () => {
    const battle = main();
    battle.players[0].oshi = inst('hSD16-001', 'miko-sp-no-target-oshi');
    battle.players[0].holoPower = [inst(dummy.number, 'miko-no-target-power-1'), inst(dummy.number, 'miko-no-target-power-2')];
    battle.players[0].zones.center = unit('hSD16-002');
    battle.players[0].zones.back1 = unit('hSD16-003');
    battle.players[1].zones.center = unit('hSD16-002', { attachments: [inst('hBP03-107', 'enemy-fan-does-not-qualify')] });

    assert.equal(isActionCandidateLegal(battle, 0, { type: 'spOshiSkill' }, pool), false, 'the SP target requirement gates activation');
    assert.throws(() => act(battle, { type: 'spOshiSkill' }), /沒有附著粉絲的さくらみこ可選擇/u);
    assert.equal(battle.players[0].holoPower.length, 2, 'failed activation cannot consume its two-Holo-Power cost');
    assert.equal(battle.players[0].spOshiSkillUsed, undefined);
    assert.equal(battle.pendingChoice, null);
  });

  test(`${runtime.name}: hSD16-004 Collab attaches one deck 35P only on the second player's first turn`, () => {
    let battle = main();
    battle.firstPlayer = 0;
    battle.activePlayer = 1;
    battle.phase = 'main';
    battle.players[1].turnsTaken = 1;
    battle.players[1].zones.back1 = unit('hSD16-004');
    battle.players[1].mainDeck = [inst(dummy.number, 'collab-holo-power'), inst('hBP03-107', 'collab-35p'), inst('hSD16-003', 'collab-tail')];
    battle = act(battle, { type: 'collab', zone: 'back1' }, 1);
    assert.equal(battle.pendingChoice?.effect, 'deckSupportToAttach');
    assert.equal(battle.pendingChoice.cards.some(item => item.id === 'collab-35p'), true, 'the revealed search offers the deck 35P');
    assert.equal(battle.players[1].holoPower[0]?.id, 'collab-holo-power', 'the ordinary Collab first moves the original deck top to Holo Power');
    battle = choose(battle, { cardIds: ['collab-35p'] }, 1);
    assert.deepEqual(battle.pendingChoice?.options, ['collab']);
    battle = choose(battle, { zone: 'collab' }, 1);
    assert.deepEqual(battle.players[1].zones.collab.attachments.map(item => item.id), ['collab-35p']);
    assert.equal(battle.players[1].mainDeck.some(item => item.id === 'collab-tail'), true);

    const excluded = main();
    excluded.players[0].zones.back1 = unit('hSD16-004');
    excluded.players[0].mainDeck = [inst('hBP03-107', 'first-player-35p')];
    const firstPlayerResult = act(excluded, { type: 'collab', zone: 'back1' });
    assert.equal(firstPlayerResult.players[0].zones.collab.attachments.length, 0, 'the first player does not get the second-player first-turn effect');
  });

  test(`${runtime.name}: hSD16-005 Arts draws exactly one on die 3 or 5, not on 1`, () => {
    const resolve = random => {
      let battle = state('hSD16-005', 'hSD16-002');
      battle.phase = 'performance';
      battle.players[0].mainDeck = [inst('hSD16-003', `dice-draw-${random}`), inst('hSD16-004', `dice-tail-${random}`)];
      fund(battle.players[0].zones.center, card('hSD16-005').arts[0].cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, 0, () => random);
      return battle;
    };
    const hit = resolve(0.4);
    assert.equal(hit.players[0].hand[0]?.id, 'dice-draw-0.4', 'a controlled roll of 3 draws one deck card');
    assert.equal(hit.players[0].mainDeck.length, 1);
    assert.equal(hit.players[1].zones.center.damage, 20, 'the Arts retains its printed damage');
    const miss = resolve(0);
    assert.equal(miss.players[0].hand.length, 0, 'a controlled roll of 1 does not draw');
    assert.equal(miss.players[0].mainDeck.length, 2);
    assert.equal(miss.players[1].zones.center.damage, 20);
  });

  test(`${runtime.name}: hSD16-002/003/004/006 Arts use the printed damage and Cheer costs`, () => {
    const cases = [
      ['hSD16-002', 0, 20, ['無色']],
      ['hSD16-003', 0, 30, ['紅']],
      ['hSD16-004', 0, 20, ['無色']],
      ['hSD16-006', 0, 20, ['無色']],
      ['hSD16-006', 1, 50, ['紅', '無色']],
    ];
    for (const [number, artIndex, damage, cost] of cases) {
      const art = card(number).arts[artIndex];
      assert.deepEqual([art.damage, art.cost], [damage, cost], `${number} art ${artIndex} catalog entry`);
      let battle = state(number, 'hSD16-002');
      battle.phase = 'performance';
      fund(battle.players[0].zones.center, cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex });
      assert.equal(battle.players[1].zones.center.damage, damage, `${number} art ${artIndex} resolved damage`);
    }
  });
}
