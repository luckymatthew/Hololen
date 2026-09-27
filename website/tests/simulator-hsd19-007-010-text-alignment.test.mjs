import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, fund } from './fixtures/simulator-audit.mjs';

const whiteDummy = { ...dummy, number: 'AUDIT-WHITE', name: 'White audit dummy', colors: ['白'], arts: [] };
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
  const pool = [...cards, dummy, whiteDummy, oshi];
  const card = number => cards.find(candidate => candidate.number === number);
  const act = (battle, action, playerIndex = 0, random = () => 0) => applyAction(battle, playerIndex, action, pool, random);
  const choose = (battle, action, playerIndex = 0, random = () => 0) => act(battle, { type: 'choose', ...action }, playerIndex, random);
  const main = () => { const battle = state('hSD19-002', 'hSD19-003'); battle.phase = 'main'; return battle; };

  test(`${runtime.name}: hSD19-007 Bloom attaches one archived Cheer to itself`, () => {
    let battle = main();
    battle.players[0].zones.back1 = unit('hSD19-002');
    battle.players[0].hand = [inst('hSD19-007', 'subaru-bloom-007')];
    battle.players[0].archive = [inst('hY06-001', 'subaru-bloom-archive-cheer')];
    battle = act(battle, { type: 'play', cardId: 'subaru-bloom-007' });
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.pendingChoice?.effect, 'archiveCheerToStage');
    assert.deepEqual(battle.pendingChoice.cards.map(item => item.id), ['subaru-bloom-archive-cheer']);
    battle = choose(battle, { cardIds: ['subaru-bloom-archive-cheer'] });
    assert.equal(battle.pendingChoice?.effect, 'attachArchiveCheer');
    battle = choose(battle, { zone: 'back1' });
    assert.deepEqual(battle.players[0].zones.back1.cheer.map(item => item.id), ['subaru-bloom-archive-cheer']);
    assert.equal(battle.players[0].archive.some(item => item.id === 'subaru-bloom-archive-cheer'), false);
  });

  test(`${runtime.name}: hSD19-007 Arts gains +20 only with at least two attached Cheer`, () => {
    const resolve = cheerCount => {
      let battle = state('hSD19-007', 'hSD19-002');
      battle.phase = 'performance';
      battle.players[1].zones.center = unit(dummy.number);
      fund(battle.players[0].zones.center, card('hSD19-007').arts[0].cost);
      battle.players[0].zones.center.cheer.push(...Array.from({ length: cheerCount - 1 }, (_, index) => inst('hY06-001', `subaru-arts-cheer-${cheerCount}-${index}`)));
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
      return battle.players[1].zones.center.damage;
    };
    assert.deepEqual([card('hSD19-007').arts[0].damage, card('hSD19-007').arts[0].cost], [30, ['無色']]);
    assert.equal(resolve(1), 30);
    assert.equal(resolve(2), 50);
    assert.equal(resolve(3), 50);
  });

  test(`${runtime.name}: hSD19-008 Collab-only Arts gains +20 when opponent has any 2nd Holomen`, () => {
    const resolve = targetNumber => {
      let battle = main();
      battle.players[0].zones.back1 = unit('hSD19-008');
      battle.players[1].zones.center = unit(targetNumber);
      battle.players[1].mainDeck = [inst('hSD19-002', `subaru-008-power-${targetNumber}`)];
      battle = act(battle, { type: 'collab', zone: 'back1' });
      battle.phase = 'performance';
      fund(battle.players[0].zones.collab, card('hSD19-008').arts[0].cost);
      battle = act(battle, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 });
      return battle.players[1].zones.center.damage;
    };
    assert.deepEqual([card('hSD19-008').arts[0].damage, card('hSD19-008').arts[0].cost], [20, ['無色']]);
    assert.equal(resolve('hSD19-006'), 20, 'opponent stage 1 does not enable the conditional +20');
    assert.equal(resolve('hSD19-009'), 40, 'opponent stage 2 enables the Collab Arts bonus');
  });

  test(`${runtime.name}: hSD19-008 cannot use its Collab-only Arts from Center`, () => {
    let battle = state('hSD19-008', 'hSD19-002');
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, card('hSD19-008').arts[0].cost);
    assert.throws(() => act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }), /這個 Arts 不能從目前位置使用/u);
  });

  test(`${runtime.name}: hSD19-009 Arts combines the low-Life and White-target bonuses independently`, () => {
    const resolve = (lifeCount, targetNumber) => {
      let battle = state('hSD19-009', targetNumber);
      battle.phase = 'performance';
      battle.players[0].life = Array.from({ length: lifeCount }, (_, index) => inst('hY01-001', `subaru-009-life-${lifeCount}-${index}`));
      battle.players[1].zones.center = unit(targetNumber);
      fund(battle.players[0].zones.center, card('hSD19-009').arts[0].cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
      return battle.players[1].zones.center.damage;
    };
    const art = card('hSD19-009').arts[0];
    assert.deepEqual([art.damage, art.cost, art.specialTargets, art.specialValues], [80, ['黃', '黃'], ['白'], [30]]);
    assert.equal(resolve(3, whiteDummy.number), 110, 'White target bonus applies without the low-Life bonus');
    assert.equal(resolve(2, dummy.number), 90, 'low-Life bonus applies without the White-target bonus');
    assert.equal(resolve(2, whiteDummy.number), 120, 'both independent bonuses apply together');
  });

  test(`${runtime.name}: hSD19-010 event heals exactly 30 HP on one selected own Holomen`, () => {
    let battle = main();
    battle.players[0].zones.center = unit('hSD19-002', { damage: 40 });
    battle.players[0].zones.back1 = unit('hSD19-003', { damage: 60 });
    battle.players[0].hand = [inst('hSD19-010', 'subaru-curry')];
    battle = act(battle, { type: 'play', cardId: 'subaru-curry' });
    assert.equal(battle.pendingChoice?.type, 'stageTarget');
    assert.deepEqual(battle.pendingChoice.options, ['center', 'back1']);
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.players[0].zones.back1.damage, 30, 'selected Holomen heals 30');
    assert.equal(battle.players[0].zones.center.damage, 40, 'unselected Holomen is unchanged');
  });
}
