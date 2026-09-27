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
  const main = () => { const battle = state('hSD18-002', 'hSD18-003'); battle.phase = 'main'; return battle; };

  test(`${runtime.name}: hSD18-001 normal Oshi archives the top two cards then draws one`, () => {
    let battle = main();
    battle.players[0].oshi = inst('hSD18-001', 'calli-normal-oshi');
    battle.players[0].holoPower = [inst(dummy.number, 'calli-power-1'), inst(dummy.number, 'calli-power-2')];
    battle.players[0].mainDeck = [inst('hSD18-003', 'calli-mill-1'), inst('hSD18-004', 'calli-mill-2'), inst('hSD18-005', 'calli-draw'), inst('hSD18-006', 'calli-tail')];
    battle = act(battle, { type: 'oshiSkill' });
    assert.deepEqual(battle.players[0].archive.map(item => item.id), [
      'calli-power-2', 'calli-power-1', 'calli-mill-1', 'calli-mill-2',
    ], 'paid Holo Power enters Archive before the top two deck cards');
    assert.deepEqual(battle.players[0].hand.map(item => item.id), ['calli-draw']);
    assert.deepEqual(battle.players[0].mainDeck.map(item => item.id), ['calli-tail']);
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.equal(battle.players[0].oshiSkillTurn, battle.turn);
  });

  test(`${runtime.name}: hSD18-001 SP gives every own Calliope +30 only at six archived Holomen`, () => {
    const resolve = archiveCount => {
      let battle = main();
      battle.players[0].oshi = inst('hSD18-001', `calli-sp-oshi-${archiveCount}`);
      battle.players[0].holoPower = [inst(dummy.number, `calli-sp-power-a-${archiveCount}`), inst(dummy.number, `calli-sp-power-b-${archiveCount}`)];
      battle.players[0].zones.center = unit('hSD18-002');
      battle.players[0].zones.back1 = unit('hSD18-004');
      battle.players[0].zones.back2 = unit('hSD18-005');
      battle.players[0].zones.back3 = unit('hSD18-003');
      battle.players[1].zones.center = unit('hSD18-002');
      battle.players[0].archive = Array.from({ length: archiveCount }, (_, index) => inst('hSD18-006', `calli-archive-${archiveCount}-${index}`));
      battle = act(battle, { type: 'spOshiSkill' });
      return battle;
    };
    const below = resolve(3);
    assert.equal(below.players[0].zones.center.modifiers.length, 0, 'three previously archived Holomen plus two paid Holo Power leave five, below threshold');
    const met = resolve(4);
    for (const zone of ['center', 'back1', 'back2', 'back3']) {
      assert.equal(met.players[0].zones[zone].modifiers.at(-1)?.amount, 30, `${zone} own Calliope receives +30`);
    }
    assert.equal(met.players[1].zones.center.modifiers.length, 0, 'opponent Calliope is not buffed');
    assert.equal(met.players[0].spOshiSkillUsed, true);
  });

  test(`${runtime.name}: hSD18-004 second-player first-turn Collab archives the deck top and draws one`, () => {
    let battle = main();
    battle.firstPlayer = 0;
    battle.activePlayer = 1;
    battle.players[1].turnsTaken = 1;
    battle.players[1].zones.back1 = unit('hSD18-004');
    battle.players[1].mainDeck = [inst('hSD18-005', 'calli-collab-archive'), inst('hSD18-006', 'calli-collab-draw'), inst('hSD18-002', 'calli-collab-tail')];
    battle = act(battle, { type: 'collab', zone: 'back1' }, 1);
    assert.deepEqual(battle.players[1].holoPower.map(item => item.id), ['calli-collab-archive'], 'the normal Collab first converts the original deck top to Holo Power');
    assert.deepEqual(battle.players[1].archive.map(item => item.id), ['calli-collab-draw'], 'the keyword archives the post-Collab deck top');
    assert.deepEqual(battle.players[1].hand.map(item => item.id), ['calli-collab-tail'], 'the keyword then draws the next card');
    assert.equal(battle.players[1].turnsTaken, 1);

    const firstPlayer = main();
    firstPlayer.players[0].zones.back1 = unit('hSD18-004');
    firstPlayer.players[0].mainDeck = [inst('hSD18-005', 'first-player-top'), inst('hSD18-006', 'first-player-next')];
    const excluded = act(firstPlayer, { type: 'collab', zone: 'back1' });
    assert.equal(excluded.players[0].archive.length, 0);
    assert.equal(excluded.players[0].hand.length, 0, 'the first player does not get the first-turn effect');
  });

  test(`${runtime.name}: hSD18-005 Collab deals 10 special damage to Center only with an own equipped Tool`, () => {
    const resolve = withTool => {
      let battle = main();
      battle.players[0].zones.back1 = unit('hSD18-005');
      battle.players[0].zones.back2 = unit('hSD18-002', { attachments: withTool ? [inst('hBP01-114', `calli-tool-${withTool}`)] : [] });
      battle.players[1].zones.center = unit(dummy.number);
      battle = act(battle, { type: 'collab', zone: 'back1' });
      return battle;
    };
    const equipped = resolve(true);
    assert.equal(card('hBP01-114').typeCode, 'supportTool');
    assert.equal(equipped.players[1].zones.center.damage, 10);
    assert.equal(equipped.players[1].zones.collab, null, 'the effect only damages the opponent Center');
    const unequipped = resolve(false);
    assert.equal(unequipped.players[1].zones.center.damage, 0, 'without an own Tool there is no special damage');
  });

  test(`${runtime.name}: hSD18-002/003/004/005/006 Arts use their printed damage and Cheer costs`, () => {
    const cases = [
      ['hSD18-002', 0, 20, ['無色']],
      ['hSD18-003', 0, 30, ['紫']],
      ['hSD18-004', 0, 20, ['無色']],
      ['hSD18-005', 0, 20, ['無色']],
      ['hSD18-006', 0, 30, ['無色']],
      ['hSD18-006', 1, 50, ['紫', '無色']],
    ];
    for (const [number, artIndex, damage, cost] of cases) {
      const art = card(number).arts[artIndex];
      assert.deepEqual([art.damage, art.cost], [damage, cost], `${number} Arts ${artIndex} catalog entry`);
      let battle = state(number, 'hSD18-002');
      battle.phase = 'performance';
      battle.players[1].zones.center = unit(dummy.number);
      fund(battle.players[0].zones.center, cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex });
      assert.equal(battle.players[1].zones.center.damage, damage, `${number} Arts ${artIndex} resolved damage`);
    }
  });
}
