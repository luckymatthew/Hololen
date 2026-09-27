import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  applyAction as websiteApplyAction,
  isActionCandidateLegal as websiteIsActionCandidateLegal,
  validateBattleDeck as websiteValidateBattleDeck,
} from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, fund } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, isActionCandidateLegal: websiteIsActionCandidateLegal, validateBattleDeck: websiteValidateBattleDeck, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const catalog = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, isActionCandidateLegal: engine.isActionCandidateLegal, validateBattleDeck: engine.validateBattleDeck, cards: catalog });
}

for (const runtime of runtimes) {
  const { applyAction, isActionCandidateLegal, validateBattleDeck, cards } = runtime;
  const pool = [...cards, dummy, oshi];
  const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);
  const card = number => cards.find(candidate => candidate.number === number);

  test(`${runtime.name}: hSD11-001 normal skill pays two Holo Power and sends one or two Archive Cheer to a zero-Cheer #FLOW GLOW Holomem`, () => {
    const tiger = card('hSD11-001');
    assert.match(tiger.oshiSkill.effect, /1～2張應援卡.*沒有應援卡.*#FLOW GLOW/u);
    let battle = state('hSD11-003');
    battle.phase = 'main';
    battle.players[0].oshi = inst(tiger.number, 'tiger-oshi');
    battle.players[0].holoPower = [inst(dummy.number, 'power-1'), inst(dummy.number, 'power-2')];
    battle.players[0].zones.center = unit('hSD11-002');
    battle.players[0].zones.back1 = unit('hSD11-003');
    battle.players[0].zones.back2 = unit('hSD11-004', { cheer: [inst('hY01-001', 'already-has-cheer')] });
    battle.players[0].zones.collab = unit('hSD11-005');
    battle.players[0].archive = [inst('hY01-001', 'archive-1'), inst('hY02-001', 'archive-2'), inst('hSD11-003', 'not-cheer')];

    assert.equal(isActionCandidateLegal(battle, 0, { type: 'oshiSkill' }, pool), true);
    battle = applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'oshiArchiveCheerFixedTarget');
    assert.deepEqual(battle.pendingChoice.options, ['center', 'collab', 'back1']);
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.pendingChoice?.effect, 'archiveCheerToStage');
    assert.equal(battle.pendingChoice.min, 1);
    assert.equal(battle.pendingChoice.max, 2);
    assert.deepEqual(new Set(battle.pendingChoice.cards.map(instance => instance.id)), new Set(['archive-1', 'archive-2']));
    battle = choose(battle, { cardIds: ['archive-1', 'archive-2'] });
    assert.equal(battle.pendingChoice?.effect, 'attachArchiveCheer');
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.pendingChoice?.effect, 'attachArchiveCheer');
    battle = choose(battle, { zone: 'back1' });

    assert.deepEqual(new Set(battle.players[0].zones.back1.cheer.map(instance => instance.id)), new Set(['archive-1', 'archive-2']));
    assert.deepEqual(new Set(battle.players[0].archive.map(instance => instance.id)), new Set(['not-cheer', 'power-1', 'power-2']));
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.equal(battle.players[0].oshiSkillTurn, battle.turn);
    assert.equal(isActionCandidateLegal(battle, 0, { type: 'oshiSkill' }, pool), false);
  });

  test(`${runtime.name}: hSD11-001 SP triggers from hSD11-004's two-Cheer Bloom cost for 60 special damage to opposing Center or Collab`, () => {
    let battle = state('hSD11-003');
    battle.phase = 'main';
    battle.players[0].oshi = inst('hSD11-001', 'tiger-oshi');
    battle.players[0].holoPower = [inst(dummy.number, 'sp-power-1'), inst(dummy.number, 'sp-power-2')];
    battle.players[0].zones.back1 = unit('hSD11-002', { cheer: [inst('hY01-001', 'cost-1'), inst('hY02-001', 'cost-2')] });
    battle.players[0].hand = [inst('hSD11-004', 'bloom')];
    battle.players[0].archive = [inst('hSD11-003', 'recover-niko')];
    battle.players[1].zones.center = unit('hSD11-002');
    battle.players[1].zones.collab = unit('hSD11-003');

    battle = applyAction(battle, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
    assert.deepEqual(battle.pendingChoice?.options, ['center', 'back1']);
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.pendingChoice?.effect, 'genericKeywordCheerCost');
    assert.equal(battle.pendingChoice.max, 1);
    battle = choose(battle, { cheerId: 'cost-1' });
    battle = choose(battle, { cheerId: 'cost-2' });
    assert.equal(battle.pendingChoice?.effect, 'archiveToHand');
    battle = choose(battle, { cardIds: ['recover-niko'] });

    assert.equal(battle.pendingChoice?.effect, 'hSD11FlowGlowArchiveSp');
    assert.equal(battle.pendingChoice.optional, true);
    assert.equal(battle.pendingChoice.meta.amount, 60);
    battle = choose(battle, { optionId: 'use' });
    assert.equal(battle.pendingChoice?.effect, 'specialDamage');
    assert.deepEqual(battle.pendingChoice.options, ['center', 'collab']);
    battle = choose(battle, { zone: 'collab' });

    assert.equal(battle.players[1].zones.collab.damage, 60);
    assert.equal(battle.players[1].zones.center.damage, 0);
    assert.equal(battle.players[0].spOshiSkillUsed, true);
    assert.equal(battle.players[0].holoPower.length, 0);
  });

  test(`${runtime.name}: hSD11-002 permits five copies under deck validation and its Colorless Arts deals 20`, () => {
    const debut = card('hSD11-002');
    assert.equal(debut.unlimited, true);
    assert.equal(debut.maxCopies, 99);
    const deck = { oshi: { 'hSD11-001': 1 }, main: { 'hSD11-002': 5, 'hSD10-007': 45 }, cheer: { 'hY01-001': 20 } };
    assert.deepEqual(validateBattleDeck(deck, pool), { ok: true });

    let battle = state(debut.number);
    fund(battle.players[0].zones.center, debut.arts[0].cost);
    battle.players[1].zones.center = unit('hSD11-003');
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 20);
  });

  test(`${runtime.name}: hSD11-003 has separate 50 and 80 damage Arts with their printed Colorless costs`, () => {
    const nikotan = card('hSD11-003');
    assert.deepEqual(nikotan.arts.map(art => [art.damage, art.cost]), [[50, ['無色', '無色']], [80, ['無色', '無色', '無色']]]);
    for (const [artIndex, expected] of [[0, 50], [1, 80]]) {
      let battle = state(nikotan.number);
      fund(battle.players[0].zones.center, nikotan.arts[artIndex].cost);
      battle.players[1].zones.center = unit('hSD11-002');
      battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex }, pool, () => 0);
      assert.equal(battle.players[1].zones.center.damage, expected);
    }
  });

  test(`${runtime.name}: hSD11-004 Bloom archives two stage Cheer and retrieves only a Niko from Archive`, () => {
    let battle = state('hSD11-003');
    battle.phase = 'main';
    battle.players[0].zones.back1 = unit('hSD11-002', { cheer: [inst('hY01-001', 'pay-1'), inst('hY02-001', 'pay-2')] });
    battle.players[0].hand = [inst('hSD11-004', 'bloom')];
    battle.players[0].archive = [inst('hSD11-003', 'niko'), inst('hSD11-005', 'other-niko')];
    battle = applyAction(battle, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.pendingChoice?.effect, 'genericKeywordCheerCost');
    battle = choose(battle, { cheerId: 'pay-1' });
    battle = choose(battle, { cheerId: 'pay-2' });
    assert.equal(battle.pendingChoice?.effect, 'archiveToHand');
    assert.deepEqual(battle.pendingChoice.cards.map(instance => instance.id), ['niko', 'other-niko']);
    battle = choose(battle, { cardIds: ['niko'] });
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'niko'));
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'other-niko'));
    assert.equal(battle.players[0].archive.filter(instance => ['pay-1', 'pay-2'].includes(instance.id)).length, 2);
  });

  test(`${runtime.name}: hSD11-004 Arts may attach only the top Cheer to an own Niko and can be declined`, () => {
    const niko = card('hSD11-004');
    const makeBattle = () => {
      const battle = state(niko.number);
      battle.players[0].zones.back1 = unit('hSD11-003');
      battle.players[0].zones.back2 = unit('hSD10-007');
      battle.players[0].zones.collab = unit('hSD11-005');
      battle.players[1].zones.center = unit('hSD11-002');
      fund(battle.players[0].zones.center, niko.arts[0].cost);
      battle.players[0].cheerDeck = [inst('hY06-001', 'top'), inst('hY01-001', 'next')];
      return battle;
    };
    let battle = applyAction(makeBattle(), 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
    assert.equal(battle.pendingChoice.optional, true);
    assert.deepEqual(new Set(battle.pendingChoice.options), new Set(['center', 'back1', 'collab']));
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.players[1].zones.center.damage, 30);
    assert.equal(battle.players[0].zones.back1.cheer.at(-1).id, 'top');
    assert.deepEqual(battle.players[0].cheerDeck.map(instance => instance.id), ['next']);

    let skipped = applyAction(makeBattle(), 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    skipped = choose(skipped, { skip: true });
    assert.equal(skipped.players[1].zones.center.damage, 30);
    assert.equal(skipped.players[0].cheerDeck.length, 2);
    assert.equal(skipped.players[0].zones.back1.cheer.length, 0);
  });

  test(`${runtime.name}: hSD11-005 Collab moves one optional Archive Cheer only to an own #FLOW GLOW Back`, () => {
    const makeBattle = () => {
      const battle = state('hSD11-005');
      battle.phase = 'main';
      battle.players[0].zones.center = unit('hSD11-004');
      battle.players[0].zones.back1 = unit('hSD11-005');
      battle.players[0].zones.back2 = unit('hSD11-003');
      battle.players[0].zones.back3 = unit(dummy.number);
      battle.players[0].archive = [inst('hY01-001', 'archive-cheer')];
      return battle;
    };
    let battle = applyAction(makeBattle(), 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'archiveCheerToStage');
    assert.equal(battle.pendingChoice.optional, true);
    battle = choose(battle, { cardIds: ['archive-cheer'] });
    assert.deepEqual(battle.pendingChoice?.options, ['back2']);
    battle = choose(battle, { zone: 'back2' });
    assert.deepEqual(battle.players[0].zones.back2.cheer.map(instance => instance.id), ['archive-cheer']);
    assert.ok(!battle.players[0].archive.some(instance => instance.id === 'archive-cheer'));

    let skipped = applyAction(makeBattle(), 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    skipped = choose(skipped, { cardIds: [] });
    assert.equal(skipped.pendingChoice, null);
    assert.ok(skipped.players[0].archive.some(instance => instance.id === 'archive-cheer'));
  });

  test(`${runtime.name}: hSD11-005 Arts gains +20 at five total stage Cheer, but not at four`, () => {
    const nikotan = card('hSD11-005');
    const attackWith = extraCheer => {
      const battle = state(nikotan.number);
      battle.players[0].zones.back1 = unit('hSD11-002', { cheer: Array.from({ length: extraCheer }, (_, index) => inst('hY01-001', `extra-${index}`)) });
      battle.players[1].zones.center = unit('hSD11-003');
      fund(battle.players[0].zones.center, nikotan.arts[0].cost);
      return applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    };
    assert.equal(attackWith(3).players[1].zones.center.damage, 30);
    assert.equal(attackWith(4).players[1].zones.center.damage, 50);
  });
}
