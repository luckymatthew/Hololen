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

const main = source => {
  const battle = state(source, 'AUDIT-DUMMY');
  battle.phase = 'main';
  return battle;
};
const performance = source => {
  const battle = state(source, 'AUDIT-DUMMY');
  battle.phase = 'performance';
  return battle;
};

for (const runtime of runtimes) {
  const { cards, applyAction } = runtime;
  const pool = [...cards, dummy];
  const card = number => cards.find(candidate => candidate.number === number);
  const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);

  test(`${runtime.name}: hSD03-001 normal Oshi skill pays 2, buffs only the Blue Center this turn, and is once per turn`, () => {
    const oshi = card('hSD03-001');
    const blueDebut = card('hSD03-002');
    const otherColor = card('hSD02-002');
    assert.deepEqual([oshi.oshiSkill.timing, oshi.oshiSkill.effect], ['Holo Power -2 · 每回合1次', '[每回合1次] 這回合中，我方的藍色中心Holomen的Arts+20。']);

    let battle = main(blueDebut.number);
    battle.players[0].oshi = inst(oshi.number);
    battle.players[0].holoPower = [inst('AUDIT-DUMMY', 'power-1'), inst('AUDIT-DUMMY', 'power-2')];
    battle = applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0);
    assert.deepEqual(new Set(battle.players[0].archive.map(instance => instance.id)), new Set(['power-1', 'power-2']));
    assert.equal(battle.players[0].zones.center.modifiers.find(modifier => modifier.kind === 'arts')?.amount, 20);
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, blueDebut.arts[0].cost);
    battle = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 50, '30 printed Arts plus the temporary +20 Oshi modifier');
    battle.phase = 'main';
    assert.throws(() => applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0), /本回合已使用/u);

    const wrongColor = main(otherColor.number);
    wrongColor.players[0].oshi = inst(oshi.number);
    wrongColor.players[0].holoPower = [inst('AUDIT-DUMMY', 'wrong-color-power-1'), inst('AUDIT-DUMMY', 'wrong-color-power-2')];
    assert.throws(() => applyAction(wrongColor, 0, { type: 'oshiSkill' }, pool, () => 0), /不是藍色/u);
    assert.equal(wrongColor.players[0].holoPower.length, 2, 'rejected activation must not consume Power');
  });

  test(`${runtime.name}: hSD03-001 SP skill triggers only from own Holomen damage to opposing Back, then deals 50 special damage for 1 Power once per game`, () => {
    const oshi = card('hSD03-001');
    const shiori = card('hSD12-004');
    const target = card('hSD03-002');
    assert.deepEqual([oshi.spOshiSkill.timing, oshi.spOshiSkill.effect], ['Holo Power -1 · 每場比賽1次', '[每場比賽1次] 當我方舞台上的Holomen對對手的後排Holomen造成傷害時可使用：對該名對手的後排Holomen造成50點特殊傷害。']);

    let battle = performance(shiori.number);
    battle.players[0].oshi = inst(oshi.number);
    battle.players[0].holoPower = [inst('AUDIT-DUMMY', 'sp-power')];
    battle.players[1].zones.back1 = unit(target.number);
    fund(battle.players[0].zones.center, shiori.arts[0].cost);
    battle = applyAction(battle, 0, { ...attack, targetZone: 'back1' }, pool, () => 0);
    assert.equal(battle.players[1].zones.back1.damage, 20, 'the initiating Arts damage resolves first');
    assert.equal(battle.pendingChoice?.effect, 'oshiAfterDamage');
    assert.equal(battle.pendingChoice?.meta?.trigger, 'backshot');
    battle = choose(battle, { optionId: 'use' });
    assert.equal(battle.players[1].zones.back1.damage, 70, 'Backshot adds 50 special damage to that same Back Holomen');
    assert.equal(battle.players[0].spOshiSkillUsed, true);
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.deepEqual(battle.players[0].archive.map(instance => instance.id), ['sp-power']);

    let centerHit = performance(shiori.number);
    centerHit.players[0].oshi = inst(oshi.number);
    centerHit.players[0].holoPower = [inst('AUDIT-DUMMY', 'unused-sp-power')];
    fund(centerHit.players[0].zones.center, shiori.arts[0].cost);
    centerHit = applyAction(centerHit, 0, attack, pool, () => 0);
    assert.equal(centerHit.pendingChoice, null, 'hitting Center does not meet the Back-only trigger');
  });

  test(`${runtime.name}: hSD03-002 unlimited Debut metadata and 30-Colorless Arts match its text`, () => {
    const okayu = card('hSD03-002');
    assert.equal(okayu.unlimited, true);
    assert.equal(okayu.maxCopies, 99, 'deck construction must allow any number of copies');
    assert.match(okayu.extra, /任意張數/u);
    assert.deepEqual([okayu.arts[0].damage, okayu.arts[0].cost], [30, ['無色']]);

    let battle = performance(okayu.number);
    fund(battle.players[0].zones.center, okayu.arts[0].cost);
    battle = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 30);
  });

  test(`${runtime.name}: hSD03-003 Arts costs one Blue Cheer for 10 damage`, () => {
    const okayu = card('hSD03-003');
    assert.deepEqual([okayu.arts[0].damage, okayu.arts[0].cost], [10, ['藍']]);
    let battle = performance(okayu.number);
    fund(battle.players[0].zones.center, okayu.arts[0].cost);
    battle = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 10);
    assert.equal(battle.players[0].zones.center.cheer.length, 1, 'the Blue Cheer pays the Arts requirement and remains attached');
  });

  test(`${runtime.name}: hSD03-003 Collab checks the Center Gamer tag, then deals 10 non-life-loss special damage to Center and one chosen Back`, () => {
    const okayu = card('hSD03-003');
    const gamer = card('hSD03-002');
    const nonGamer = cards.find(candidate => candidate.group === 'holomem' && candidate.stage === 'Debut' && !candidate.tags.includes('#ゲーマーズ'));
    assert.ok(nonGamer, 'catalog needs a non-Gamer Debut control');

    let gated = main(nonGamer.number);
    gated.players[0].zones.back1 = unit(okayu.number);
    gated.players[1].zones.center = unit(gamer.number);
    gated.players[1].zones.back1 = unit(gamer.number);
    gated = applyAction(gated, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(gated.players[1].zones.center.damage, 0, 'without #ゲーマーズ at our Center, the Collab ability does not resolve');
    assert.equal(gated.players[1].zones.back1.damage, 0);
    assert.equal(gated.pendingChoice, null);

    let battle = main(gamer.number);
    battle.players[0].zones.back1 = unit(okayu.number);
    battle.players[1].zones.center = unit(gamer.number, { damage: 90 });
    battle.players[1].zones.back1 = unit(gamer.number);
    const lifeBefore = battle.players[1].life.length;
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.players[1].zones.center, null, '10 special damage can knock out the Center');
    assert.equal(battle.players[1].life.length, lifeBefore, 'the text expressly prevents Life loss even when that hit knocks out');
    assert.equal(battle.pendingChoice?.effect, 'specialDamage');
    assert.deepEqual(battle.pendingChoice.options, ['back1']);
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.players[1].zones.back1.damage, 10);
    assert.equal(battle.players[1].life.length, lifeBefore);
  });

  test(`${runtime.name}: hSD03-004 Arts costs one Colorless Cheer for 20 damage`, () => {
    const okayu = card('hSD03-004');
    assert.deepEqual([okayu.arts[0].damage, okayu.arts[0].cost], [20, ['無色']]);
    let battle = performance(okayu.number);
    fund(battle.players[0].zones.center, okayu.arts[0].cost);
    battle = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 20);
  });

  test(`${runtime.name}: hSD03-004 Collab may reveal top, attaches top Cheer only for Debut/Spot, and bottoms the revealed card`, () => {
    const okayu = card('hSD03-004');
    const debut = card('hSD03-002');
    const nonEligible = cards.find(candidate => candidate.group === 'holomem' && !['Debut', 'Spot'].includes(candidate.stage));
    const cheer = cards.find(candidate => candidate.group === 'cheer');
    assert.ok(nonEligible && cheer, 'catalog needs an ineligible Holomen and Cheer fixture');

    let battle = main(debut.number);
    battle.players[0].zones.back1 = unit(okayu.number);
    battle.players[0].mainDeck = [inst('AUDIT-DUMMY', 'collab-power'), inst(debut.number, 'revealed-debut'), inst('AUDIT-DUMMY', 'deck-tail')];
    battle.players[0].cheerDeck = [inst(cheer.number, 'top-cheer')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'starterSuiseiReveal');
    assert.equal(battle.pendingChoice?.optional, true);
    battle = choose(battle, { optionId: 'reveal' });
    assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
    assert.deepEqual(battle.pendingChoice.options, ['collab']);
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['deck-tail', 'revealed-debut']);
    battle = choose(battle, { zone: 'collab' });
    assert.deepEqual(battle.players[0].zones.collab.cheer.map(instance => instance.id), ['top-cheer']);

    let skip = main(debut.number);
    skip.players[0].zones.back1 = unit(okayu.number);
    skip.players[0].mainDeck = [inst('AUDIT-DUMMY', 'skip-collab-power'), inst(debut.number, 'kept-top')];
    skip = applyAction(skip, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    skip = choose(skip, { skip: true });
    assert.deepEqual(skip.players[0].mainDeck.map(instance => instance.id), ['kept-top'], 'declining reveal leaves the deck untouched');

    let ineligible = main(debut.number);
    ineligible.players[0].zones.back1 = unit(okayu.number);
    ineligible.players[0].mainDeck = [inst('AUDIT-DUMMY', 'ineligible-collab-power'), inst(nonEligible.number, 'revealed-1st'), inst('AUDIT-DUMMY', 'deck-tail')];
    ineligible.players[0].cheerDeck = [inst(cheer.number, 'unused-cheer')];
    ineligible = applyAction(ineligible, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    ineligible = choose(ineligible, { optionId: 'reveal' });
    assert.equal(ineligible.pendingChoice, null, 'a non-Debut/Spot reveal grants no Cheer target');
    assert.deepEqual(ineligible.players[0].mainDeck.map(instance => instance.id), ['deck-tail', 'revealed-1st']);
    assert.deepEqual(ineligible.players[0].cheerDeck.map(instance => instance.id), ['unused-cheer']);
  });

  test(`${runtime.name}: hSD03-005 first Arts is 30 Colorless and second is 50 Blue plus Colorless`, () => {
    const okayu = card('hSD03-005');
    assert.deepEqual(okayu.arts.map(art => [art.damage, art.cost]), [[30, ['無色']], [50, ['藍', '無色']]]);

    for (const [artIndex, expectedDamage] of [[0, 30], [1, 50]]) {
      let battle = performance(okayu.number);
      fund(battle.players[0].zones.center, okayu.arts[artIndex].cost);
      battle = applyAction(battle, 0, { ...attack, artIndex }, pool, () => 0);
      assert.equal(battle.players[1].zones.center.damage, expectedDamage);
      assert.equal(battle.players[0].zones.center.cheer.length, okayu.arts[artIndex].cost.length, `Arts ${artIndex} uses the printed Cheer without discarding it`);
    }

    let short = performance(okayu.number);
    short.players[0].zones.center.cheer = [inst('hY04-001', 'blue-only')];
    assert.throws(() => applyAction(short, 0, { ...attack, artIndex: 1 }, pool, () => 0), /應援不足/u);
    assert.equal(short.players[0].zones.center.cheer.length, 1, 'cannot pay the full Blue plus Colorless cost with only Blue');
  });
}
