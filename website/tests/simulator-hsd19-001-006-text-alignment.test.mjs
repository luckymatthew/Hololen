import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, fund } from './fixtures/simulator-audit.mjs';

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
  const pool = [...cards, dummy, oshi];
  const card = number => cards.find(candidate => candidate.number === number);
  const act = (battle, action, playerIndex = 0, random = () => 0) => applyAction(battle, playerIndex, action, pool, random);
  const choose = (battle, action, playerIndex = 0, random = () => 0) => act(battle, { type: 'choose', ...action }, playerIndex, random);
  const main = () => { const battle = state('hSD19-002', 'hSD19-003'); battle.phase = 'main'; return battle; };

  test(`${runtime.name}: hSD19-001 normal Oshi returns one archived Holomen to hand`, () => {
    let battle = main();
    battle.players[0].oshi = inst('hSD19-001', 'subaru-oshi-normal');
    battle.players[0].holoPower = Array.from({ length: 3 }, (_, index) => inst(dummy.number, `subaru-normal-cost-${index}`));
    battle.players[0].archive = [inst('hSD18-002', 'subaru-archive-holomem'), inst('hY01-001', 'subaru-archive-cheer')];
    battle = act(battle, { type: 'oshiSkill' });
    assert.equal(battle.pendingChoice?.effect, 'archiveToHand');
    assert.deepEqual(battle.pendingChoice.cards.map(item => item.id), [
      'subaru-archive-holomem', 'subaru-normal-cost-2', 'subaru-normal-cost-1', 'subaru-normal-cost-0',
    ], 'the archived Holomen, including paid Holo Power, are selectable; the archived Cheer is excluded');
    battle = choose(battle, { cardIds: ['subaru-archive-holomem'] });
    assert.equal(battle.players[0].hand.some(item => item.id === 'subaru-archive-holomem'), true);
    assert.equal(battle.players[0].archive.some(item => item.id === 'subaru-archive-holomem'), false);
    assert.equal(battle.players[0].oshiSkillTurn, battle.turn);
  });

  test(`${runtime.name}: hSD19-001 SP distributes archived Cheer to one or two distinct own Subaru`, () => {
    let battle = main();
    battle.players[0].oshi = inst('hSD19-001', 'subaru-oshi-sp');
    battle.players[0].holoPower = [inst(dummy.number, 'subaru-sp-cost-1'), inst(dummy.number, 'subaru-sp-cost-2')];
    battle.players[0].zones.center = unit('hSD19-002');
    battle.players[0].zones.back1 = unit('hSD19-003');
    battle.players[0].zones.back2 = unit('hSD19-004');
    battle.players[0].zones.back3 = unit('hSD18-003');
    battle.players[0].archive = [inst('hY01-001', 'subaru-sp-cheer-1'), inst('hY02-001', 'subaru-sp-cheer-2')];
    battle = act(battle, { type: 'spOshiSkill' });
    assert.equal(battle.pendingChoice?.effect, 'archiveCheerToStage');
    assert.deepEqual(battle.pendingChoice.cards.map(item => item.id), ['subaru-sp-cheer-1', 'subaru-sp-cheer-2']);
    battle = choose(battle, { cardIds: ['subaru-sp-cheer-1', 'subaru-sp-cheer-2'] });
    assert.equal(battle.pendingChoice?.type, 'stageTarget');
    assert.deepEqual(battle.pendingChoice.options, ['center', 'back1', 'back2']);
    battle = choose(battle, { zone: 'center' });
    assert.equal(battle.pendingChoice?.type, 'stageTarget');
    assert.deepEqual(battle.pendingChoice.options, ['back1', 'back2'], 'the second cheer must go to a distinct Subaru');
    battle = choose(battle, { zone: 'back1' });
    assert.deepEqual(battle.players[0].zones.center.cheer.map(item => item.id), ['subaru-sp-cheer-1']);
    assert.deepEqual(battle.players[0].zones.back1.cheer.map(item => item.id), ['subaru-sp-cheer-2']);
    assert.equal(battle.players[0].zones.back2.cheer.length, 0);
    assert.equal(battle.players[0].spOshiSkillUsed, true);
  });

  test(`${runtime.name}: hSD19-002/004/005/006 Arts resolve their printed damage and Cheer costs`, () => {
    for (const [number, artIndex, damage, cost] of [
      ['hSD19-002', 0, 10, ['無色']],
      ['hSD19-004', 0, 20, ['無色']],
      ['hSD19-005', 0, 20, ['無色']],
      ['hSD19-006', 0, 20, ['無色']],
      ['hSD19-006', 1, 40, ['黃', '無色']],
    ]) {
      assert.deepEqual([card(number).arts[artIndex].damage, card(number).arts[artIndex].cost], [damage, cost], `${number} Arts ${artIndex} catalog entry`);
      let battle = state(number, 'hSD19-002');
      battle.phase = 'performance';
      battle.players[1].zones.center = unit(dummy.number);
      fund(battle.players[0].zones.center, cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex });
      assert.equal(battle.players[1].zones.center.damage, damage, `${number} Arts ${artIndex} resolved damage`);
    }
  });

  test(`${runtime.name}: hSD19-003 gains +10 Arts only at two or fewer Life`, () => {
    const resolve = lifeCount => {
      let battle = state('hSD19-003', 'hSD19-002');
      battle.phase = 'performance';
      battle.players[0].life = Array.from({ length: lifeCount }, (_, index) => inst('hY01-001', `subaru-life-${lifeCount}-${index}`));
      battle.players[1].zones.center = unit(dummy.number);
      fund(battle.players[0].zones.center, card('hSD19-003').arts[0].cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
      return battle.players[1].zones.center.damage;
    };
    assert.deepEqual([card('hSD19-003').arts[0].damage, card('hSD19-003').arts[0].cost], [20, ['黃']]);
    assert.equal(resolve(3), 20);
    assert.equal(resolve(2), 30);
    assert.equal(resolve(1), 30);
  });

  test(`${runtime.name}: hSD19-004 only offers a Deck Debut on the second player's first-turn Collab`, () => {
    let battle = main();
    battle.firstPlayer = 0;
    battle.activePlayer = 1;
    battle.players[1].turnsTaken = 1;
    battle.players[1].zones.back1 = unit('hSD19-004');
    battle.players[1].mainDeck = [inst('hSD19-002', 'subaru-collab-power'), inst('hSD19-003', 'subaru-search-debut'), inst('hSD19-006', 'subaru-search-tail')];
    battle = act(battle, { type: 'collab', zone: 'back1' }, 1);
    assert.equal(battle.pendingChoice?.effect, 'deckCardsToStage');
    assert.deepEqual(battle.pendingChoice.cards.map(item => item.id), ['subaru-search-debut']);
    battle = choose(battle, { cardIds: ['subaru-search-debut'] }, 1);
    assert.equal(battle.pendingChoice?.type, 'stageTarget');
    assert.deepEqual(battle.pendingChoice.options, ['back1', 'back2', 'back3', 'back4', 'back5']);
    battle = choose(battle, { zone: 'back2' }, 1);
    assert.equal(battle.players[1].zones.back2.stack.at(-1).number, 'hSD19-003');
    assert.equal(battle.players[1].mainDeck.some(item => item.id === 'subaru-search-tail'), true);

    let firstPlayer = main();
    firstPlayer.firstPlayer = 0;
    firstPlayer.players[0].turnsTaken = 1;
    firstPlayer.players[0].zones.back1 = unit('hSD19-004');
    firstPlayer.players[0].mainDeck = [inst('hSD19-003', 'subaru-first-player-debut')];
    firstPlayer = act(firstPlayer, { type: 'collab', zone: 'back1' });
    assert.equal(firstPlayer.pendingChoice, null, 'the first player does not get the first-turn Collab search');
    assert.equal(firstPlayer.players[0].zones.back2, null);
  });

  test(`${runtime.name}: hSD19-005 reduces damage by 10 only from the opponent Center`, () => {
    let center = state('hSD19-005', 'hSD19-002');
    center.activePlayer = 1;
    center.phase = 'performance';
    fund(center.players[1].zones.center, card('hSD19-002').arts[0].cost);
    center = act(center, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, 1);
    assert.equal(center.players[0].zones.center.damage, 0, 'opponent Center 10 Arts is reduced by 10');

    let collab = state('hSD19-005', dummy.number);
    collab.activePlayer = 1;
    collab.phase = 'main';
    collab.players[1].zones.back1 = unit('hSD19-002');
    collab = act(collab, { type: 'collab', zone: 'back1' }, 1);
    collab.phase = 'performance';
    fund(collab.players[1].zones.collab, card('hSD19-002').arts[0].cost);
    collab = act(collab, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 }, 1);
    assert.equal(collab.players[0].zones.center.damage, 10, 'opponent Collab damage is not reduced');
  });
}
