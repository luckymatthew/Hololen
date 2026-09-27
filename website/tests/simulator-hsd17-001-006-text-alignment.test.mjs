import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, fund } from './fixtures/simulator-audit.mjs';

const backDummy = { ...dummy, number: 'AUDIT-BACK', name: 'Back audit dummy', jpName: 'Back audit dummy', arts: [] };
const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const catalog = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, cards: catalog });
}

for (const runtime of runtimes) {
  const { applyAction, cards } = runtime;
  const pool = [...cards, dummy, backDummy, oshi];
  const card = number => cards.find(candidate => candidate.number === number);
  const act = (battle, action, playerIndex = 0, random = () => 0) => applyAction(battle, playerIndex, action, pool, random);
  const choose = (battle, action, playerIndex = 0, random = () => 0) => act(battle, { type: 'choose', ...action }, playerIndex, random);
  const main = () => { const battle = state('hSD17-002', 'hSD17-003'); battle.phase = 'main'; return battle; };

  test(`${runtime.name}: hSD17-001 normal Oshi attaches the Cheer Deck top to one own Holomen`, () => {
    let battle = main();
    battle.players[0].oshi = inst('hSD17-001', 'suisei-normal-oshi');
    battle.players[0].holoPower = Array.from({ length: 3 }, (_, index) => inst(dummy.number, `suisei-normal-power-${index}`));
    battle.players[0].zones.back1 = unit('hSD17-004');
    battle.players[0].cheerDeck = [inst('hY04-001', 'suisei-cheer-top'), inst('hY02-001', 'suisei-cheer-tail')];

    battle = act(battle, { type: 'oshiSkill' });
    assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
    assert.deepEqual(battle.pendingChoice.options, ['center', 'back1']);
    assert.equal(battle.players[0].holoPower.length, 0);
    battle = choose(battle, { zone: 'back1' });
    assert.deepEqual(battle.players[0].zones.back1.cheer.map(item => item.id), ['suisei-cheer-top']);
    assert.deepEqual(battle.players[0].cheerDeck.map(item => item.id), ['suisei-cheer-tail']);
    assert.equal(battle.players[0].oshiSkillTurn, battle.turn);
  });

  test(`${runtime.name}: hSD17-001 SP only deals 50 special damage to an opponent Back when Center is Suisei`, () => {
    let battle = main();
    battle.players[0].oshi = inst('hSD17-001', 'suisei-sp-oshi');
    battle.players[0].holoPower = [inst(dummy.number, 'suisei-sp-power-1'), inst(dummy.number, 'suisei-sp-power-2')];
    battle.players[0].zones.center = unit('hSD17-002');
    battle.players[1].zones.back1 = unit(backDummy.number);
    battle.players[1].zones.back2 = unit(backDummy.number);

    battle = act(battle, { type: 'spOshiSkill' });
    assert.equal(battle.pendingChoice?.effect, 'specialDamage');
    assert.deepEqual(battle.pendingChoice.options, ['back1', 'back2']);
    assert.equal(battle.pendingChoice.meta.amount, 50);
    assert.equal(battle.players[0].holoPower.length, 0);
    battle = choose(battle, { zone: 'back2' });
    assert.equal(battle.players[1].zones.back2.damage, 50);
    assert.equal(battle.players[1].zones.back1.damage, 0);
    assert.equal(battle.players[0].spOshiSkillUsed, true);

    const conditionMiss = main();
    conditionMiss.players[0].oshi = inst('hSD17-001', 'suisei-sp-wrong-center');
    conditionMiss.players[0].holoPower = [inst(dummy.number, 'wrong-center-power-1'), inst(dummy.number, 'wrong-center-power-2')];
    conditionMiss.players[0].zones.center = unit('hSD15-002');
    conditionMiss.players[1].zones.back1 = unit(backDummy.number);
    const noEffect = act(conditionMiss, { type: 'spOshiSkill' });
    assert.equal(noEffect.pendingChoice, null, 'the Center condition prevents an ineligible damage target choice');
    assert.equal(noEffect.players[1].zones.back1.damage, 0);
  });

  test(`${runtime.name}: hSD17-004 first-turn Collab deals 20 special damage only for the second player`, () => {
    let battle = main();
    battle.firstPlayer = 0;
    battle.activePlayer = 1;
    battle.players[1].turnsTaken = 1;
    battle.players[1].zones.back1 = unit('hSD17-004');
    battle.players[1].mainDeck = [inst(dummy.number, 'suisei-collab-power'), inst('hSD17-002', 'suisei-collab-tail')];
    battle.players[0].zones.back1 = unit(backDummy.number);
    battle.players[0].zones.back2 = unit(backDummy.number);
    battle = act(battle, { type: 'collab', zone: 'back1' }, 1);
    assert.equal(battle.pendingChoice?.effect, 'specialDamage');
    assert.deepEqual(battle.pendingChoice.options, ['back1', 'back2']);
    assert.equal(battle.pendingChoice.meta.amount, 20);
    battle = choose(battle, { zone: 'back1' }, 1);
    assert.equal(battle.players[0].zones.back1.damage, 20);

    const firstPlayer = main();
    firstPlayer.players[0].zones.back1 = unit('hSD17-004');
    firstPlayer.players[0].mainDeck = [inst(dummy.number, 'first-player-collab-power')];
    firstPlayer.players[1].zones.back1 = unit(backDummy.number);
    const noTrigger = act(firstPlayer, { type: 'collab', zone: 'back1' });
    assert.equal(noTrigger.pendingChoice, null, 'first player does not get this second-player first-turn effect');
  });

  test(`${runtime.name}: hSD17-005 Arts adds its printed 10 Back special damage separately`, () => {
    assert.deepEqual([card('hSD17-005').arts[0].damage, card('hSD17-005').arts[0].cost], [20, ['無色']]);
    let battle = state('hSD17-005', 'hSD17-002');
    battle.phase = 'performance';
    battle.players[1].zones.back1 = unit(backDummy.number);
    battle.players[1].zones.back2 = unit(backDummy.number);
    fund(battle.players[0].zones.center, card('hSD17-005').arts[0].cost);
    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(battle.pendingChoice?.effect, 'specialDamage');
    assert.deepEqual(battle.pendingChoice.options, ['back1', 'back2']);
    assert.equal(battle.pendingChoice.meta.amount, 10);
    battle = choose(battle, { zone: 'back2' });
    assert.equal(battle.players[1].zones.center.damage, 20, 'the ordinary Arts damage resolves separately for 20');
    assert.equal(battle.players[1].zones.back2.damage, 10);
  });

  test(`${runtime.name}: hSD17-002/003/004/006 Arts use the printed damage and Cheer costs`, () => {
    const cases = [
      ['hSD17-002', 0, 20, ['無色']],
      ['hSD17-003', 0, 30, ['藍']],
      ['hSD17-004', 0, 20, ['無色']],
      ['hSD17-006', 0, 30, ['無色']],
      ['hSD17-006', 1, 50, ['藍', '無色']],
    ];
    for (const [number, artIndex, damage, cost] of cases) {
      const art = card(number).arts[artIndex];
      assert.deepEqual([art.damage, art.cost], [damage, cost], `${number} Arts ${artIndex} catalog entry`);
      let battle = state(number, 'hSD17-002');
      battle.phase = 'performance';
      fund(battle.players[0].zones.center, cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex });
      assert.equal(battle.players[1].zones.center.damage, damage, `${number} Arts ${artIndex} damage`);
    }
  });
}
