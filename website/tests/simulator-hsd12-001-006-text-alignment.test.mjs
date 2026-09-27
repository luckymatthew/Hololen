import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  applyAction as websiteApplyAction,
  validateBattleDeck as websiteValidateBattleDeck,
} from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, fund } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, validateBattleDeck: websiteValidateBattleDeck, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const catalog = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, validateBattleDeck: engine.validateBattleDeck, cards: catalog });
}

for (const runtime of runtimes) {
  const { applyAction, validateBattleDeck, cards } = runtime;
  const pool = [...cards, dummy, oshi];
  const card = number => cards.find(candidate => candidate.number === number);
  const choose = (battle, action, playerIndex = 0) => applyAction(battle, playerIndex, { type: 'choose', ...action }, pool, () => 0);
  const main = (source = dummy.number, target = dummy.number) => {
    const battle = state(source, target);
    battle.phase = 'main';
    return battle;
  };
  const performance = (source = dummy.number, target = dummy.number) => {
    const battle = state(source, target);
    battle.phase = 'performance';
    return battle;
  };

  test(`${runtime.name}: hSD12-001 Oshi reveals exactly three, adds one Support, and bottoms the other two in chosen order`, () => {
    const shiori = card('hSD12-001');
    const support = cards.find(candidate => candidate.group === 'support');
    assert.ok(support, 'catalog needs a Support for the positive top-look case');
    let battle = main('hSD12-003');
    battle.players[0].oshi = inst(shiori.number, 'shiori-oshi');
    battle.players[0].holoPower = [inst(dummy.number, 'normal-power')];
    battle.players[0].mainDeck = [inst('hSD12-003', 'first-rest'), inst(support.number, 'support-hit'), inst('hSD12-005', 'third-rest')];
    battle = applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'topLookToHand');
    assert.equal(battle.pendingChoice.cards.length, 3);
    assert.deepEqual(battle.pendingChoice.selectableIds, ['support-hit']);
    battle = choose(battle, { cardIds: ['support-hit'] });
    assert.deepEqual(battle.pendingChoice?.effect, 'bottomOrder');
    battle = choose(battle, { cardIds: ['third-rest', 'first-rest'] });
    assert.deepEqual(battle.players[0].hand.map(instance => instance.id), ['support-hit']);
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['third-rest', 'first-rest']);
    assert.deepEqual(battle.players[0].archive.map(instance => instance.id), ['normal-power']);
    assert.equal(battle.players[0].oshiSkillTurn, battle.turn);

    let noSupport = main('hSD12-003');
    noSupport.players[0].oshi = inst(shiori.number, 'shiori-oshi');
    noSupport.players[0].holoPower = [inst(dummy.number, 'normal-power')];
    noSupport.players[0].mainDeck = [inst('hSD12-003', 'debut'), inst('hSD12-004', 'first'), inst('hSD12-006', 'buzz-first')];
    noSupport = applyAction(noSupport, 0, { type: 'oshiSkill' }, pool, () => 0);
    assert.equal(noSupport.pendingChoice?.effect, 'bottomOrder', 'if the three revealed cards contain no Support, all three go to the bottom');
    assert.equal(noSupport.pendingChoice.min, 3);
    noSupport = choose(noSupport, { cardIds: ['buzz-first', 'debut', 'first'] });
    assert.equal(noSupport.players[0].hand.length, 0);
    assert.deepEqual(noSupport.players[0].mainDeck.map(instance => instance.id), ['buzz-first', 'debut', 'first']);
  });

  test(`${runtime.name}: hSD12-001 SP damage is 10 per archived Support and only targets opposing non-Debut Back`, () => {
    const shiori = card('hSD12-001');
    const support = cards.find(candidate => candidate.group === 'support');
    const nonSupport = cards.find(candidate => candidate.group === 'holomem' && !candidate.tags?.includes('#Advent'));
    assert.ok(support && nonSupport);
    let battle = main('hSD12-003');
    battle.players[0].oshi = inst(shiori.number, 'shiori-oshi');
    battle.players[0].holoPower = Array.from({ length: 3 }, (_, index) => inst(dummy.number, `sp-power-${index}`));
    battle.players[0].archive = [inst(support.number, 'support-a'), inst(support.number, 'support-b'), inst('hY06-001', 'cheer'), inst(nonSupport.number, 'non-advent-holomem')];
    battle.players[1].zones.back1 = unit('hSD12-003');
    battle.players[1].zones.back2 = unit('hSD12-004');
    battle = applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'specialDamage');
    assert.deepEqual(battle.pendingChoice.options, ['back2']);
    assert.equal(battle.pendingChoice.meta.amount, 20);
    battle = choose(battle, { zone: 'back2' });
    assert.equal(battle.players[1].zones.back2.damage, 20);
    assert.equal(battle.players[1].zones.back1.damage, 0);
    assert.equal(battle.players[0].spOshiSkillUsed, true);
    assert.equal(battle.players[0].holoPower.length, 0);
  });

  test(`${runtime.name}: hSD12-002 Oshi archives both Cheer tops and draws once per distinct archived color`, () => {
    const biboo = card('hSD12-002');
    const resolve = (first, second, expectedDraw) => {
      let battle = main('hSD12-003');
      battle.players[0].oshi = inst(biboo.number, 'biboo-oshi');
      battle.players[0].holoPower = [inst(dummy.number, 'power-1'), inst(dummy.number, 'power-2')];
      battle.players[0].cheerDeck = [inst(first, 'own-top'), inst('hY02-001', 'own-next')];
      battle.players[1].cheerDeck = [inst(second, 'opp-top'), inst('hY02-001', 'opp-next')];
      battle = applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0);
      assert.equal(battle.players[0].cheerDeck[0].id, 'own-next');
      assert.equal(battle.players[1].cheerDeck[0].id, 'opp-next');
      assert.deepEqual(new Set(battle.players[0].archive.map(instance => instance.id)), new Set(['own-top', 'power-1', 'power-2']));
      assert.deepEqual(battle.players[1].archive.map(instance => instance.id), ['opp-top']);
      assert.equal(battle.players[0].hand.length, expectedDraw);
      assert.equal(battle.players[0].oshiSkillTurn, battle.turn);
    };
    resolve('hY06-001', 'hY06-001', 1);
    resolve('hY06-001', 'hY04-001', 2);
  });

  test(`${runtime.name}: hSD12-002 SP counts only Archive Cheer and #Advent Holomen for Center special damage`, () => {
    const biboo = card('hSD12-002');
    const otherHolomem = cards.find(candidate => candidate.group === 'holomem' && !candidate.tags?.includes('#Advent'));
    assert.ok(otherHolomem);
    let battle = main('hSD12-003', 'hSD12-004');
    battle.players[0].oshi = inst(biboo.number, 'biboo-oshi');
    battle.players[0].holoPower = [inst(dummy.number, 'sp-power-1'), inst(dummy.number, 'sp-power-2')];
    battle.players[0].archive = [inst('hY01-001', 'cheer-1'), inst('hY06-001', 'cheer-2'), inst('hSD12-003', 'advent'), inst(otherHolomem.number, 'other-holomem'), inst('hBP01-104', 'support')];
    battle = applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 30);
    assert.equal(battle.players[0].spOshiSkillUsed, true);
    assert.equal(battle.players[0].holoPower.length, 0);
  });

  test(`${runtime.name}: hSD12-003 basic Arts pays Colorless and deals its printed 20 damage`, () => {
    const shiori = card('hSD12-003');
    assert.deepEqual([shiori.arts[0].damage, shiori.arts[0].cost], [20, ['無色']]);
    let battle = performance(shiori.number);
    fund(battle.players[0].zones.center, shiori.arts[0].cost);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 20);
  });

  test(`${runtime.name}: hSD12-003 Collab deals 10 special damage to one selected opposing Back`, () => {
    let battle = main('hSD12-007');
    battle.players[0].zones.back1 = unit('hSD12-003');
    battle.players[1].zones.back1 = unit('hSD12-004');
    battle.players[1].zones.back2 = unit('hSD12-005');
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'specialDamage');
    assert.deepEqual(battle.pendingChoice.options, ['back1', 'back2']);
    assert.equal(battle.pendingChoice.meta.amount, 10);
    battle = choose(battle, { zone: 'back2' });
    assert.equal(battle.players[1].zones.back1.damage, 0);
    assert.equal(battle.players[1].zones.back2.damage, 10);
  });

  test(`${runtime.name}: hSD12-004 Arts 0 may target Back and deals 20`, () => {
    const shiori = card('hSD12-004');
    assert.match(shiori.arts[0].effect, /對手的後排/u);
    let battle = performance(shiori.number, 'hSD12-003');
    battle.players[1].zones.back1 = unit('hSD12-005');
    fund(battle.players[0].zones.center, shiori.arts[0].cost);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'back1', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.back1.damage, 20);
    assert.equal(battle.players[1].zones.center.damage, 0);
  });

  test(`${runtime.name}: hSD12-004 Arts 1 requires four archived Supports to attach the top Cheer to own Advent`, () => {
    const shiori = card('hSD12-004');
    const support = cards.find(candidate => candidate.group === 'support');
    assert.ok(support);
    const attack = archiveCount => {
      let battle = performance(shiori.number);
      battle.players[0].zones.back1 = unit('hSD12-003');
      battle.players[0].archive = Array.from({ length: archiveCount }, (_, index) => inst(support.number, `support-${index}`));
      battle.players[0].cheerDeck = [inst('hY01-001', 'top-cheer'), inst('hY02-001', 'next-cheer')];
      fund(battle.players[0].zones.center, shiori.arts[1].cost);
      return applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 1 }, pool, () => 0);
    };
    let battle = attack(4);
    assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
    assert.deepEqual(battle.pendingChoice.options, ['center', 'back1']);
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.players[0].zones.back1.cheer.at(-1).id, 'top-cheer');
    assert.equal(battle.players[0].cheerDeck[0].id, 'next-cheer');
    assert.equal(battle.players[1].zones.center.damage, 30);

    const below = attack(3);
    assert.equal(below.pendingChoice, null);
    assert.equal(below.players[0].zones.back1.cheer.length, 0);
    assert.equal(below.players[0].cheerDeck.length, 2);
    assert.equal(below.players[1].zones.center.damage, 30);
  });

  test(`${runtime.name}: hSD12-005 basic Arts pays Colorless and deals its printed 40 damage`, () => {
    const shiori = card('hSD12-005');
    assert.deepEqual([shiori.arts[0].damage, shiori.arts[0].cost], [40, ['無色']]);
    let battle = performance(shiori.number);
    fund(battle.players[0].zones.center, shiori.arts[0].cost);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 40);
  });

  test(`${runtime.name}: hSD12-005 Collab must move an Archive Cheer to an own #Advent Holomem`, () => {
    let battle = main('hSD11-007');
    battle.players[0].zones.back1 = unit('hSD12-005');
    battle.players[0].zones.back2 = unit('hSD12-003');
    battle.players[0].archive = [inst('hY04-001', 'archive-blue')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'archiveCheerToStage');
    assert.equal(battle.pendingChoice.optional, false);
    assert.deepEqual(battle.pendingChoice.cards.map(instance => instance.id), ['archive-blue']);
    battle = choose(battle, { cardIds: ['archive-blue'] });
    assert.equal(battle.pendingChoice?.effect, 'attachArchiveCheer');
    assert.deepEqual(battle.pendingChoice.options, ['collab', 'back2']);
    battle = choose(battle, { zone: 'back2' });
    assert.equal(battle.players[0].zones.back2.cheer[0].id, 'archive-blue');
    assert.equal(battle.players[0].archive.length, 0);
  });

  test(`${runtime.name}: hSD12-006 Bloom may archive a hand Support, then searches only Debut/1st #Advent and shuffles`, () => {
    const shiori = card('hSD12-006');
    const support = cards.find(candidate => candidate.group === 'support');
    const nonAdventDebut = cards.find(candidate => candidate.group === 'holomem' && candidate.stage === 'Debut' && !candidate.tags?.includes('#Advent'));
    assert.ok(support && nonAdventDebut);
    let battle = main('hSD12-003');
    battle.players[0].hand = [inst(shiori.number, 'shiori-bloom'), inst(support.number, 'support-cost')];
    battle.players[0].mainDeck = [inst('hSD12-003', 'advent-debut'), inst('hSD12-009', 'advent-first'), inst('hSD12-007', 'advent-second'), inst(nonAdventDebut.number, 'other-debut')];
    battle = applyAction(battle, 0, { type: 'play', cardId: 'shiori-bloom' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.type, 'bloom');
    assert.deepEqual(battle.pendingChoice.options, ['center']);
    battle = choose(battle, { zone: 'center' });
    assert.equal(battle.pendingChoice?.effect, 'genericKeywordHandArchiveCost');
    assert.equal(battle.pendingChoice.optional, true);
    assert.deepEqual(battle.pendingChoice.cards.map(instance => instance.id), ['support-cost']);
    battle = choose(battle, { cardIds: ['support-cost'] });
    assert.equal(battle.pendingChoice?.effect, 'deckToHandShuffle');
    assert.deepEqual(new Set(battle.pendingChoice.cards.map(instance => instance.id)), new Set(['advent-debut', 'advent-first']));
    battle = choose(battle, { cardIds: ['advent-first'] });
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'advent-first'));
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'support-cost'));
    assert.equal(battle.players[0].mainDeck.length, 3);
    assert.ok(!battle.players[0].mainDeck.some(instance => instance.id === 'advent-first'));
  });

  test(`${runtime.name}: hSD12-006 Arts deals 40 plus 20 special damage to a chosen opposing Holomem`, () => {
    const shiori = card('hSD12-006');
    assert.deepEqual([shiori.arts[0].damage, shiori.arts[0].cost], [40, ['藍', '無色']]);
    assert.match(shiori.arts[0].effect, /20點特殊傷害/u);
    let battle = performance(shiori.number, 'hSD12-004');
    battle.players[1].zones.back1 = unit('hSD12-005');
    fund(battle.players[0].zones.center, shiori.arts[0].cost);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'specialDamage');
    assert.deepEqual(battle.pendingChoice.options, ['center', 'back1']);
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.players[1].zones.back1.damage, 20);
    assert.equal(battle.players[1].zones.center.damage, 40);
  });

  test(`${runtime.name}: hSD12-006 Buzz Extra applies the printed two-Life loss on knockout`, () => {
    const shiori = card('hSD12-006');
    assert.equal(shiori.type, 'Buzz Holomen');
    assert.match(shiori.extra, /生命值減少2點/u);
    let battle = performance(dummy.number, shiori.number);
    battle.players[0].zones.center.damage = 0;
    battle.players[1].zones.back1 = unit('hSD12-003');
    battle.players[1].life = Array.from({ length: 5 }, (_, index) => inst('hY01-001', `life-${index}`));
    battle.players[1].zones.center.damage = Math.max(0, Number(shiori.hp || 0) - 100);
    battle.players[0].zones.center.stack = [inst(dummy.number, 'attacker')];
    battle.players[0].zones.center.cheer = [];
    battle.players[0].zones.center.rested = false;
    // Use a synthetic high-damage Arts on the attacker while preserving its catalog identity.
    const attacker = { ...dummy, number: 'AUDIT-OVERCAP', arts: [{ name: 'Overcap', damage: 220, cost: [] }] };
    const battlePool = [...pool, attacker];
    battle.players[0].zones.center.stack = [inst(attacker.number, 'attacker')];
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, battlePool, () => 0);
    assert.equal(battle.players[1].zones.center, null, 'the Buzz is knocked out');
    assert.equal(battle.players[1].life.length, 3, 'the Buzz Extra changes the normal one Life loss to two');
    assert.equal(battle.pendingChoice?.type, 'lifeCheerTarget');
    assert.equal(battle.pendingChoice.playerIndex, 1);
    battle = choose(battle, { zone: 'back1' }, 1);
    assert.equal(battle.pendingChoice?.type, 'lifeCheerTarget', 'both revealed Life Cheer cards must be attached');
    battle = choose(battle, { zone: 'back1' }, 1);
    assert.equal(battle.pendingChoice, null);
    assert.equal(battle.players[1].zones.back1.cheer.length, 2);
  });
}
