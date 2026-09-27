import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, fund, inst, state, unit } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const cards = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, cards });
}

for (const runtime of runtimes) {
  const { applyAction, cards } = runtime;
  const card = number => cards.find(candidate => candidate.number === number);
  const marineOshi = card('hSD09-001');
  const marineDebut = card('hSD09-002');
  const marineFirst = card('hSD09-003');
  const marineSecond = card('hSD09-004');
  const noel = card('hSD09-005');
  const pekora = card('hSD09-006');
  const flare = card('hSD09-007');
  const yellowDummy = { ...dummy, number: 'AUDIT-HSD09-YELLOW', colors: ['黃'], hp: 10000 };
  const pool = [...cards, dummy, yellowDummy];
  const choose = (battle, playerIndex, action) => applyAction(battle, playerIndex, { type: 'choose', ...action }, pool, () => 0);
  const main = () => { const battle = state(); battle.phase = 'main'; return battle; };

  test(`${runtime.name}: hSD09-001 normal Oshi skill pays two, buffs only the Red Center by 20 this turn`, () => {
    assert.ok(marineOshi?.oshiSkill);
    const redCenter = cards.find(candidate => candidate.group === 'holomem'
      && candidate.stage && candidate.colors?.includes('紅') && candidate.arts?.[0]?.damage > 0
      && !(candidate.arts[0].specialTargets || []).length && !candidate.arts[0].effect);
    assert.ok(redCenter, 'catalogue provides a Red Holomen with an uncomplicated Arts');
    let battle = main();
    battle.players[0].oshi = inst(marineOshi.number);
    battle.players[0].zones.center = unit(redCenter.number);
    battle.players[0].holoPower = [inst(dummy.number, 'normal-power-a'), inst(dummy.number, 'normal-power-b')];
    battle = applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0);
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.equal(battle.players[0].oshiSkillTurn, battle.turn);
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, redCenter.arts[0].cost);
    battle.players[1].zones.center = unit(dummy.number);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, redCenter.arts[0].damage + 20);

    const nonRedCenter = cards.find(candidate => candidate.group === 'holomem'
      && candidate.stage && !candidate.colors?.includes('紅') && candidate.arts?.[0]?.damage > 0);
    assert.ok(nonRedCenter);
    let invalid = main();
    invalid.players[0].oshi = inst(marineOshi.number);
    invalid.players[0].zones.center = unit(nonRedCenter.number);
    invalid.players[0].holoPower = [inst(dummy.number, 'invalid-power-a'), inst(dummy.number, 'invalid-power-b')];
    assert.throws(() => applyAction(invalid, 0, { type: 'oshiSkill' }, pool, () => 0), /不是紅色/u);
  });

  test(`${runtime.name}: hSD09-001 SP skill retrieves one Red Holomen from Archive and ignores nonmatches`, () => {
    const red = cards.find(candidate => candidate.group === 'holomem' && candidate.colors?.includes('紅'));
    const green = cards.find(candidate => candidate.group === 'holomem' && candidate.colors?.includes('綠'));
    assert.ok(red && green);
    let battle = main();
    battle.players[0].oshi = inst(marineOshi.number);
    battle.players[0].holoPower = [inst(dummy.number, 'sp-power')];
    battle.players[0].archive = [inst(green.number, 'green-archive'), inst('hY03-001', 'red-cheer'), inst(red.number, 'red-archive')];
    battle = applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0);
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.equal(battle.players[0].spOshiSkillUsed, true);
    assert.equal(battle.pendingChoice?.optional, false);
    assert.deepEqual(battle.pendingChoice.cards.map(instance => instance.id), ['red-archive']);
    battle = choose(battle, 0, { cardIds: ['red-archive'] });
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'red-archive'));
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'green-archive'));
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'red-cheer'));
  });

  test(`${runtime.name}: hSD09-002 Arts deals 20 Colorless; Collab searches only the next five for a #Summer Debut`, () => {
    assert.deepEqual([marineDebut.arts[0].damage, marineDebut.arts[0].cost], [20, ['無色']]);
    let attackBattle = state();
    attackBattle.phase = 'performance';
    attackBattle.players[0].zones.center = unit(marineDebut.number);
    fund(attackBattle.players[0].zones.center, marineDebut.arts[0].cost);
    attackBattle.players[1].zones.center = unit(dummy.number);
    attackBattle = applyAction(attackBattle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(attackBattle.players[1].zones.center.damage, 20);

    const summer = cards.find(candidate => candidate.group === 'holomem' && candidate.stage === 'Debut'
      && candidate.tags?.includes('#サマー') && candidate.number !== marineDebut.number);
    assert.ok(summer);
    let battle = main();
    battle.players[0].zones.back1 = unit(marineDebut.number);
    battle.players[0].mainDeck = [inst(dummy.number, 'collab-power'), inst(dummy.number, 'top-a'), inst(summer.number, 'summer-hit'), inst(dummy.number, 'top-c'), inst(dummy.number, 'top-d'), inst(dummy.number, 'top-e'), inst(summer.number, 'outside-five')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.optional, false);
    assert.deepEqual(battle.pendingChoice.selectableIds, ['summer-hit']);
    battle = choose(battle, 0, { cardIds: ['summer-hit'] });
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'summer-hit'));
    assert.equal(battle.pendingChoice?.effect, 'bottomOrder');
    const rest = battle.pendingChoice.cards.map(instance => instance.id);
    assert.deepEqual(new Set(rest), new Set(['top-a', 'top-c', 'top-d', 'top-e']));
    battle = choose(battle, 0, { cardIds: [...rest].reverse() });
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['outside-five', ...[...rest].reverse()]);
  });

  test(`${runtime.name}: hSD09-003 Arts is 50 Red/Colorless; Collab special damage counts distinct #3期生 names`, () => {
    assert.deepEqual([marineFirst.arts[0].damage, marineFirst.arts[0].cost], [50, ['紅', '無色']]);
    const members = cards.filter(candidate => candidate.group === 'holomem' && candidate.tags?.includes('#3期生')
      && candidate.jpName !== marineFirst.jpName);
    const byName = [...new Map(members.map(candidate => [candidate.jpName || candidate.name, candidate])).values()];
    assert.ok(byName.length >= 2);
    let battle = main();
    battle.players[0].zones.back1 = unit(marineFirst.number);
    battle.players[0].zones.back2 = unit(byName[0].number);
    battle.players[0].zones.back3 = unit(byName[0].number);
    battle.players[0].zones.back4 = unit(byName[1].number);
    battle.players[1].zones.collab = unit(dummy.number);
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 30, 'Marine and two other distinct names count; the repeated name does not');
    assert.equal(battle.players[1].zones.collab.damage, 0, 'printed special damage targets only the opposing Center');

    let attackBattle = state();
    attackBattle.phase = 'performance';
    attackBattle.players[0].zones.center = unit(marineFirst.number);
    fund(attackBattle.players[0].zones.center, marineFirst.arts[0].cost);
    attackBattle.players[1].zones.center = unit(dummy.number);
    attackBattle = applyAction(attackBattle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(attackBattle.players[1].zones.center.damage, 50);

    let buzzBattle = state();
    buzzBattle.players[0].zones.center = unit(dummy.number);
    buzzBattle.players[1].zones.center = unit(dummy.number);
    buzzBattle.players[1].zones.collab = unit(marineFirst.number, { damage: marineFirst.hp - 100 });
    buzzBattle.players[1].zones.back1 = unit(dummy.number);
    buzzBattle = applyAction(buzzBattle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'collab', artIndex: 0 }, pool, () => 0);
    for (let count = 0; buzzBattle.pendingChoice && count < 4; count += 1) {
      assert.equal(buzzBattle.pendingChoice.type, 'lifeCheerTarget');
      buzzBattle = choose(buzzBattle, 1, { zone: 'back1' });
    }
    assert.equal(buzzBattle.players[1].zones.collab, null);
    assert.equal(buzzBattle.players[1].life.length, 3, 'Buzz knockout loses exactly two Life');
  });

  test(`${runtime.name}: hSD09-004 first Arts draws only with another #3期生 and applies Yellow bonus`, () => {
    const nonMarine = cards.find(candidate => candidate.group === 'holomem' && candidate.tags?.includes('#3期生')
      && candidate.jpName !== marineSecond.jpName);
    assert.ok(nonMarine);
    let battle = state();
    battle.phase = 'performance';
    battle.players[0].zones.center = unit(marineSecond.number);
    battle.players[0].zones.back1 = unit(nonMarine.number);
    fund(battle.players[0].zones.center, marineSecond.arts[0].cost);
    battle.players[1].zones.center = unit(yellowDummy.number);
    const handBefore = battle.players[0].hand.length;
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, marineSecond.arts[0].damage + 50);
    assert.equal(battle.players[0].hand.length, handBefore + 1);

    let control = state();
    control.phase = 'performance';
    control.players[0].zones.center = unit(marineSecond.number);
    fund(control.players[0].zones.center, marineSecond.arts[0].cost);
    control.players[1].zones.center = unit(yellowDummy.number);
    control = applyAction(control, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(control.players[0].hand.length, 0, 'Marine alone does not satisfy the other-member draw condition');
  });

  test(`${runtime.name}: hSD09-004 second Arts scales special damage by distinct #3期生 and adds Yellow Arts bonus`, () => {
    const member = cards.find(candidate => candidate.group === 'holomem' && candidate.tags?.includes('#3期生')
      && candidate.jpName !== marineSecond.jpName);
    assert.ok(member);
    let battle = state();
    battle.phase = 'performance';
    battle.players[0].zones.center = unit(marineSecond.number);
    battle.players[0].zones.back1 = unit(member.number);
    battle.players[0].zones.back2 = unit(member.number);
    fund(battle.players[0].zones.center, marineSecond.arts[1].cost);
    battle.players[1].zones.center = unit(yellowDummy.number);
    battle.players[1].zones.collab = unit(yellowDummy.number);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 1 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, marineSecond.arts[1].damage + 50 + 20, '120 Arts, Yellow bonus, and 20 special damage from two distinct names');
    assert.equal(battle.players[1].zones.collab.damage, 20);
  });

  test(`${runtime.name}: hSD09-005 Collab grants Center 2nd Arts +10 per distinct #3期生 name for this turn`, () => {
    const other = card('hSD09-006');
    assert.ok(noel?.keyword && marineSecond?.stage === '2nd');
    let battle = main();
    battle.players[0].zones.center = unit(marineSecond.number);
    battle.players[0].zones.back1 = unit(noel.number);
    battle.players[0].zones.back2 = unit(other.number);
    battle.players[0].zones.back3 = unit(other.number);
    battle.players[1].zones.center = unit(dummy.number);
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, marineSecond.arts[0].cost);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, marineSecond.arts[0].damage + 30, 'Marine, Noel and Pekora count once each');
    assert.equal(battle.players[0].hand.length, 1, 'Marine 2nd first Arts still draws for another third-generation Holomen');

    let wrongCenter = main();
    wrongCenter.players[0].zones.center = unit(dummy.number);
    wrongCenter.players[0].zones.back1 = unit(noel.number);
    wrongCenter.players[0].zones.back2 = unit(other.number);
    wrongCenter.players[1].zones.center = unit(dummy.number);
    wrongCenter = applyAction(wrongCenter, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    wrongCenter.phase = 'performance';
    wrongCenter = applyAction(wrongCenter, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(wrongCenter.players[1].zones.center.damage, dummy.arts[0].damage, 'non-2nd Center receives no Collab Arts modifier');
  });

  test(`${runtime.name}: hSD09-006 Arts is 10 Colorless; Collab attaches top Cheer only on second player's first turn`, () => {
    assert.deepEqual([pekora.arts[0].damage, pekora.arts[0].cost], [10, ['無色']]);
    let attackBattle = state();
    attackBattle.phase = 'performance';
    attackBattle.players[0].zones.center = unit(pekora.number);
    fund(attackBattle.players[0].zones.center, pekora.arts[0].cost);
    attackBattle.players[1].zones.center = unit(dummy.number);
    attackBattle = applyAction(attackBattle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(attackBattle.players[1].zones.center.damage, 10);

    const member = card('hSD09-005');
    let battle = main();
    battle.firstPlayer = 1;
    battle.players[0].turnsTaken = 1;
    battle.players[0].zones.back1 = unit(pekora.number);
    battle.players[0].zones.back2 = unit(member.number);
    battle.players[0].cheerDeck = [inst('hY03-001', 'top-cheer'), inst('hY01-001', 'next-cheer')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.ok(battle.pendingChoice?.options.includes('back2'));
    battle = choose(battle, 0, { zone: 'back2' });
    assert.equal(battle.players[0].zones.back2.cheer[0].id, 'top-cheer');
    assert.equal(battle.players[0].cheerDeck[0].id, 'next-cheer');

    let outOfWindow = main();
    outOfWindow.firstPlayer = 0;
    outOfWindow.players[0].turnsTaken = 1;
    outOfWindow.players[0].zones.back1 = unit(pekora.number);
    outOfWindow.players[0].zones.back2 = unit(member.number);
    outOfWindow.players[0].cheerDeck = [inst('hY03-001', 'not-attached')];
    outOfWindow = applyAction(outOfWindow, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(outOfWindow.pendingChoice, null);
    assert.equal(outOfWindow.players[0].cheerDeck.length, 1);
  });

  test(`${runtime.name}: hSD09-007 Arts is 80 for three Colorless; Collab Gift reduces Life loss only when behind on opponent's turn`, () => {
    assert.deepEqual([flare.arts[0].damage, flare.arts[0].cost], [80, ['無色', '無色', '無色']]);
    let attackBattle = state();
    attackBattle.phase = 'performance';
    attackBattle.players[0].zones.center = unit(flare.number);
    fund(attackBattle.players[0].zones.center, flare.arts[0].cost);
    attackBattle.players[1].zones.center = unit(dummy.number);
    attackBattle = applyAction(attackBattle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(attackBattle.players[1].zones.center.damage, 80);

    const knockOutFlare = (zone, ownerLife, opponentLife) => {
      let battle = state();
      battle.phase = 'performance';
      battle.players[0].zones.center = unit(dummy.number);
      battle.players[1].zones.center = unit(dummy.number);
      battle.players[1].zones[zone] = unit(flare.number);
      battle.players[0].life = battle.players[0].life.slice(0, opponentLife);
      battle.players[1].life = battle.players[1].life.slice(0, ownerLife);
      battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: zone, artIndex: 0 }, pool, () => 0);
      return battle;
    };
    const protectedKnockout = knockOutFlare('collab', 4, 5);
    assert.equal(protectedKnockout.players[1].zones.collab, null);
    assert.equal(protectedKnockout.players[1].life.length, 4, 'Collab KO while behind prevents the one Life loss');
    assert.equal(knockOutFlare('collab', 5, 5).players[1].life.length, 4, 'equal Life totals do not qualify');
    assert.equal(knockOutFlare('center', 4, 5).players[1].life.length, 3, 'the Gift does not apply outside Collab');
  });
}
