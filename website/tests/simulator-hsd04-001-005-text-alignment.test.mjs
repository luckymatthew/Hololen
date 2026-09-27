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
  const foodHolomem = { ...dummy, number: 'AUDIT-FOOD-HOLO', name: 'Food-tag Holomen control', jpName: 'フード', tags: ['#食物'] };
  const pool = [...cards, dummy, foodHolomem];
  const card = number => cards.find(candidate => candidate.number === number);
  const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);
  const play = (battle, id) => applyAction(battle, 0, { type: 'play', cardId: id }, pool, () => 0);

  test(`${runtime.name}: hSD04-001 normal Choco Oshi skill pays 2, buffs only Purple Center Arts +20, once per turn`, () => {
    const oshi = card('hSD04-001');
    const choco = card('hSD04-005');
    const wrongColor = card('hSD03-002');
    assert.deepEqual([oshi.oshiSkill.timing, oshi.oshiSkill.timingCode], ['Holo Power -2 · 每回合1次', 'once_per_turn']);
    assert.match(oshi.oshiSkill.effect, /紫色中心Holomen.*\+20/u);

    let battle = main(choco.number);
    battle.players[0].oshi = inst(oshi.number);
    battle.players[0].holoPower = [inst('AUDIT-DUMMY', 'power-1'), inst('AUDIT-DUMMY', 'power-2')];
    battle = applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0);
    assert.deepEqual(new Set(battle.players[0].archive.map(instance => instance.id)), new Set(['power-1', 'power-2']));
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, choco.arts[0].cost);
    battle = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 40, '20 printed Arts plus 20 from Choco Oshi');
    battle.phase = 'main';
    assert.throws(() => applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0), /本回合已使用/u);

    let blocked = main(wrongColor.number);
    blocked.players[0].oshi = inst(oshi.number);
    blocked.players[0].holoPower = [inst('AUDIT-DUMMY', 'untouched-1'), inst('AUDIT-DUMMY', 'untouched-2')];
    assert.throws(() => applyAction(blocked, 0, { type: 'oshiSkill' }, pool, () => 0), /不是紫色/u);
    assert.equal(blocked.players[0].holoPower.length, 2, 'wrong Center color must not consume Power');
  });

  test(`${runtime.name}: hSD04-001 SP skill draws two, archives one hand card and cannot repeat during the game`, () => {
    const oshi = card('hSD04-001');
    let battle = main();
    battle.players[0].oshi = inst(oshi.number);
    battle.players[0].holoPower = [inst('AUDIT-DUMMY', 'sp-power')];
    battle.players[0].hand = [inst('AUDIT-DUMMY', 'kept')];
    battle.players[0].mainDeck = [inst('AUDIT-DUMMY', 'draw-1'), inst('AUDIT-DUMMY', 'draw-2'), inst('AUDIT-DUMMY', 'tail')];
    battle = applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0);
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.deepEqual(battle.players[0].hand.map(instance => instance.id), ['kept', 'draw-1', 'draw-2']);
    assert.equal(battle.pendingChoice?.effect, 'handToArchive');
    assert.equal(battle.pendingChoice.min, 1);
    assert.equal(battle.pendingChoice.max, 1);
    battle = choose(battle, { cardIds: ['draw-1'] });
    assert.deepEqual(battle.players[0].archive.map(instance => instance.id), ['sp-power', 'draw-1']);
    assert.deepEqual(battle.players[0].hand.map(instance => instance.id), ['kept', 'draw-2']);
    assert.equal(battle.players[0].spOshiSkillUsed, true);
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['tail']);
    assert.throws(() => applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0), /已使用過 SP/u);
  });

  test(`${runtime.name}: hSD04-002 unlimited Debut may be included in any quantity and its Arts is 30 for one Colorless`, () => {
    const choco = card('hSD04-002');
    assert.equal(choco.stage, 'Debut');
    assert.equal(choco.unlimited, true);
    assert.equal(choco.maxCopies, 99);
    assert.match(choco.extra, /任意張數/u);
    assert.deepEqual([choco.arts[0].damage, choco.arts[0].cost], [30, ['無色']]);
    let battle = performance(choco.number);
    fund(battle.players[0].zones.center, choco.arts[0].cost);
    battle = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 30);
  });

  test(`${runtime.name}: hSD04-003 Collab draws only when own Oshi is Purple; its Arts costs Purple plus Colorless`, () => {
    const choco = card('hSD04-003');
    assert.equal(choco.keyword?.type, 'collab_effect');
    assert.deepEqual([choco.arts[0].damage, choco.arts[0].cost], [30, ['紫', '無色']]);
    const trigger = oshiNumber => {
      let battle = main();
      battle.players[0].oshi = inst(oshiNumber);
      battle.players[0].zones.back1 = unit(choco.number);
      battle.players[0].mainDeck = [inst('AUDIT-DUMMY', `collab-power-${oshiNumber}`), inst('AUDIT-DUMMY', `draw-${oshiNumber}`)];
      battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
      return battle;
    };
    const purple = trigger('hSD04-001');
    assert.deepEqual(purple.players[0].hand.map(instance => instance.id), ['draw-hSD04-001']);
    assert.equal(purple.players[0].mainDeck.length, 0);
    assert.equal(purple.players[0].holoPower[0].id, 'collab-power-hSD04-001');
    const nonPurple = trigger('hYS01-001');
    assert.deepEqual(nonPurple.players[0].hand, []);
    assert.deepEqual(nonPurple.players[0].mainDeck.map(instance => instance.id), ['draw-hYS01-001']);
    assert.equal(nonPurple.players[0].holoPower[0].id, 'collab-power-hYS01-001');
  });

  test(`${runtime.name}: hSD04-004 Collab optionally archives a hand card, searches only #食物 Events and shuffles`, () => {
    const choco = card('hSD04-004');
    const foodEvent = cards.find(candidate => candidate.group === 'support' && ['supportEvent', 'supportEventLimited'].includes(candidate.typeCode) && candidate.tags.includes('#食物'));
    const ordinaryEvent = cards.find(candidate => candidate.group === 'support' && ['supportEvent', 'supportEventLimited'].includes(candidate.typeCode) && !candidate.tags.includes('#食物'));
    assert.ok(foodEvent && ordinaryEvent, 'catalog needs a Food Event and a non-Food Event control');
    assert.equal(choco.keyword?.type, 'collab_effect');
    assert.deepEqual([choco.arts[0].damage, choco.arts[0].cost], [20, ['紫']]);

    let paid = main();
    paid.players[0].zones.back1 = unit(choco.number);
    paid.players[0].hand = [inst('AUDIT-DUMMY', 'discard')];
    paid.players[0].mainDeck = [inst('AUDIT-DUMMY', 'collab-power'), inst(ordinaryEvent.number, 'wrong-event'), inst(foodHolomem.number, 'wrong-group'), inst(foodEvent.number, 'food-event'), inst('AUDIT-DUMMY', 'tail')];
    paid = applyAction(paid, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(paid.players[0].holoPower[0].id, 'collab-power');
    assert.equal(paid.pendingChoice?.optional, true, 'the hand archive cost is optional');
    assert.deepEqual(paid.pendingChoice.selectableIds, ['discard']);
    paid = choose(paid, { cardIds: ['discard'] });
    assert.equal(paid.players[0].archive.at(-1)?.id, 'discard');
    assert.equal(paid.pendingChoice?.effect, 'deckToHandShuffle');
    assert.deepEqual(paid.pendingChoice.selectableIds, ['food-event'], 'non-Food Events and Food-tagged Holomen are excluded');
    paid = choose(paid, { cardIds: ['food-event'] });
    assert.ok(paid.players[0].hand.some(instance => instance.id === 'food-event'));
    assert.ok(paid.players[0].mainDeck.some(instance => instance.id === 'wrong-event'));
    assert.ok(paid.players[0].mainDeck.some(instance => instance.id === 'wrong-group'));
    assert.ok(paid.players[0].mainDeck.some(instance => instance.id === 'tail'));

    let skipped = main();
    skipped.players[0].zones.back1 = unit(choco.number);
    skipped.players[0].hand = [inst('AUDIT-DUMMY', 'keep')];
    skipped.players[0].mainDeck = [inst('AUDIT-DUMMY', 'skipped-collab-power'), inst(foodEvent.number, 'not-searched')];
    skipped = applyAction(skipped, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    skipped = choose(skipped, { skip: true });
    assert.equal(skipped.pendingChoice, null);
    assert.deepEqual(skipped.players[0].hand.map(instance => instance.id), ['keep']);
    assert.equal(skipped.players[0].mainDeck[0].id, 'not-searched');
  });

  test(`${runtime.name}: hSD04-005's Purple Arts deal 20 for one and 40 for Purple plus Colorless`, () => {
    const choco = card('hSD04-005');
    assert.deepEqual(choco.arts.map(art => [art.damage, art.cost]), [[20, ['紫']], [40, ['紫', '無色']]]);
    for (const artIndex of [0, 1]) {
      let battle = performance(choco.number);
      fund(battle.players[0].zones.center, choco.arts[artIndex].cost);
      battle = applyAction(battle, 0, { ...attack, artIndex }, pool, () => 0);
      assert.equal(battle.players[1].zones.center.damage, choco.arts[artIndex].damage);
    }
  });
}
