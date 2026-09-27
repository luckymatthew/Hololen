import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, state, unit, inst, fund, attack } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const cards = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, cards });
}

const main = (source = 'AUDIT-DUMMY', target = 'AUDIT-DUMMY') => {
  const battle = state(source, target);
  battle.phase = 'main';
  return battle;
};

for (const runtime of runtimes) {
  const { cards, applyAction } = runtime;
  const card = number => cards.find(candidate => candidate.number === number);
  const pool = [...cards, dummy];
  const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);
  const play = (battle, id) => applyAction(battle, 0, { type: 'play', cardId: id }, pool, () => 0);

  test(`${runtime.name}: hSD06-001 normal Oshi costs two Power and buffs only own Green Center Arts +20 for the turn`, () => {
    const iroha = card('hSD06-001');
    const green = card('hSD06-002');
    const nonGreen = card('hSD05-011');
    assert.equal(iroha.colors.includes('綠'), true);
    assert.equal(iroha.oshiSkill.timingCode, 'once_per_turn');
    assert.match(iroha.oshiSkill.effect, /綠色中心Holomen的Arts\+20/u);

    let battle = main();
    battle.players[0].oshi = inst(iroha.number);
    battle.players[0].zones.center = unit(green.number);
    battle.players[0].zones.back1 = unit(green.number);
    battle.players[0].zones.collab = unit(nonGreen.number);
    battle.players[0].holoPower = [inst(dummy.number, 'power-a'), inst(dummy.number, 'power-b')];
    battle = applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0);
    assert.deepEqual(new Set(battle.players[0].archive.map(instance => instance.id)), new Set(['power-a', 'power-b']));
    assert.ok(battle.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 20 && modifier.expiresTurn === battle.turn));
    assert.equal(battle.players[0].zones.back1.modifiers.length, 0, 'the skill buffs the Center, not every Green Holomen');
    assert.equal(battle.players[0].zones.collab.modifiers.length, 0, 'a non-Green Collab is not an eligible target');
    assert.throws(() => applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0), /本回合已使用/u);
  });

  test(`${runtime.name}: hSD06-001 SP costs one Power once per game and heals every Green Holomen by 20`, () => {
    const iroha = card('hSD06-001');
    const debut = card('hSD06-002');
    const greenFirst = card('hSD06-004');
    const nonGreen = card('hSD05-011');
    assert.equal(iroha.spOshiSkill.timingCode, 'once_per_game');
    assert.match(iroha.spOshiSkill.effect, /所有綠色Holomen回復20點HP/u);

    let battle = main();
    battle.players[0].oshi = inst(iroha.number);
    battle.players[0].zones.center = unit(debut.number, { damage: 40 });
    battle.players[0].zones.back1 = unit(greenFirst.number, { damage: 60 });
    battle.players[0].zones.collab = unit(nonGreen.number, { damage: 30 });
    battle.players[0].holoPower = [inst(dummy.number, 'sp-power')];
    battle = applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0);
    assert.equal(battle.players[0].zones.center.damage, 20);
    assert.equal(battle.players[0].zones.back1.damage, 40);
    assert.equal(battle.players[0].zones.collab.damage, 30, 'the non-Green Holomen is not healed');
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.equal(battle.players[0].spOshiSkillUsed, true);
    assert.throws(() => applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0), /已使用/u);
  });

  test(`${runtime.name}: hSD06-002 deals 20 Arts for one Colorless and Collab heals a chosen own Holomen by 10`, () => {
    const iroha = card('hSD06-002');
    assert.equal(iroha.keyword.type, 'collab_effect');
    assert.match(iroha.keyword.effect, /自己的一位Holomen回復10點HP/u);
    assert.deepEqual([iroha.arts[0].damage, iroha.arts[0].cost], [20, ['無色']]);

    let arts = main(iroha.number);
    arts.phase = 'performance';
    fund(arts.players[0].zones.center, iroha.arts[0].cost);
    arts = applyAction(arts, 0, attack, pool, () => 0);
    assert.equal(arts.players[1].zones.center.damage, 20);

    let battle = main();
    battle.players[0].zones.center.damage = 30;
    battle.players[0].zones.back1 = unit(iroha.number, { damage: 20 });
    battle.players[0].mainDeck = [inst(dummy.number, 'collab-power'), inst(dummy.number, 'tail')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'heal');
    assert.deepEqual(new Set(battle.pendingChoice.options), new Set(['center', 'collab']));
    battle = choose(battle, { zone: 'collab' });
    assert.equal(battle.players[0].zones.collab.damage, 10);
    assert.equal(battle.players[0].zones.center.damage, 30);
  });

  test(`${runtime.name}: hSD06-003 Arts is 30 Green, gaining exactly 10 while own Center has damage`, () => {
    const iroha = card('hSD06-003');
    assert.deepEqual([iroha.arts[0].damage, iroha.arts[0].cost], [30, ['綠']]);
    assert.match(iroha.arts[0].effect, /自己的中央Holomen HP減少時.*力量\+10/u);

    let plain = main(iroha.number);
    plain.phase = 'performance';
    fund(plain.players[0].zones.center, iroha.arts[0].cost);
    plain = applyAction(plain, 0, attack, pool, () => 0);
    assert.equal(plain.players[1].zones.center.damage, 30);

    let damaged = main(iroha.number);
    damaged.phase = 'performance';
    damaged.players[0].zones.center.damage = 1;
    fund(damaged.players[0].zones.center, iroha.arts[0].cost);
    damaged = applyAction(damaged, 0, attack, pool, () => 0);
    assert.equal(damaged.players[1].zones.center.damage, 40);
  });

  test(`${runtime.name}: hSD06-004 deals 60 Arts for Green plus Colorless`, () => {
    const iroha = card('hSD06-004');
    assert.deepEqual([iroha.arts[0].damage, iroha.arts[0].cost], [60, ['綠', '無色']]);
    let battle = main(iroha.number);
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, iroha.arts[0].cost);
    battle = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 60);
  });

  test(`${runtime.name}: hSD06-005 Bloom attaches the top Cheer only to an own #秘密結社holoX Holomen`, () => {
    const debut = card('hSD06-002');
    const first = card('hSD06-005');
    const target = card('hSD06-003');
    const decoy = card('hSD05-011');
    const cheer = cards.find(candidate => candidate.group === 'cheer');
    assert.equal(first.keyword.type, 'bloom_effect');
    assert.match(first.keyword.effect, /應援牌庫頂抽1張，送給自己具有#秘密結社holoX的成員/u);
    assert.deepEqual([first.arts[0].damage, first.arts[0].cost], [30, ['綠']]);

    let battle = main();
    battle.players[0].zones.center = unit(target.number);
    battle.players[0].zones.back1 = unit(debut.number);
    battle.players[0].zones.collab = unit(decoy.number);
    battle.players[0].hand = [inst(first.number, 'iroha-bloom')];
    battle.players[0].cheerDeck = [inst(cheer.number, 'top-green-cheer'), inst(cheer.number, 'cheer-tail')];
    battle = play(battle, 'iroha-bloom');
    assert.ok(battle.pendingChoice?.options.includes('back1'), 'the Bloom can replace the Debut in its stage position');
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
    assert.deepEqual(new Set(battle.pendingChoice.options), new Set(['center', 'back1']));
    battle = choose(battle, { zone: 'center' });
    assert.equal(battle.players[0].zones.center.cheer[0]?.id, 'top-green-cheer');
    assert.deepEqual(battle.players[0].cheerDeck.map(instance => instance.id), ['cheer-tail']);
    assert.equal(battle.players[0].zones.collab.cheer.length, 0, 'non-holoX Holomen cannot receive the Cheer');
  });
}
