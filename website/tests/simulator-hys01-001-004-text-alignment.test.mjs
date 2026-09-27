import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction, isActionCandidateLegal as websiteIsActionCandidateLegal } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, state, unit, inst, fund, attack } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, isActionCandidateLegal: websiteIsActionCandidateLegal, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const cards = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, isActionCandidateLegal: engine.isActionCandidateLegal, cards });
}

const oshiRows = [
  ['hYS01-001', '白', '白色'],
  ['hYS01-002', '綠', '綠色'],
  ['hYS01-003', '紅', '紅色'],
  ['hYS01-004', '藍', '藍色'],
];
const auditHolomen = (number, colors, { damage = 10, hp = 1000 } = {}) => ({
  ...dummy,
  number,
  name: number,
  jpName: number,
  stage: 'Debut',
  hp,
  colors: Array.isArray(colors) ? colors : [colors],
  arts: [{ name: 'Audit Arts', damage, cost: [], effect: '' }],
});
const main = () => {
  const battle = state();
  battle.phase = 'main';
  return battle;
};
const power = id => inst(dummy.number, id);

for (const runtime of runtimes) {
  const { cards, applyAction, isActionCandidateLegal } = runtime;
  const card = number => cards.find(candidate => candidate.number === number);
  const choose = (battle, playerIndex, action) => applyAction(battle, playerIndex, { type: 'choose', ...action }, pool, () => 0);
  const coloredUnits = oshiRows.map(([number, color]) => auditHolomen(`AUDIT-${number}`, color));
  const wrongColorUnits = oshiRows.map(([number, color]) => auditHolomen(`AUDIT-WRONG-${number}`, oshiRows.find(row => row[1] !== color)[1]));
  const white = auditHolomen('AUDIT-HYS-WHITE', '白');
  const green = auditHolomen('AUDIT-HYS-GREEN', '綠');
  const red = auditHolomen('AUDIT-HYS-RED', '紅');
  const blue = auditHolomen('AUDIT-HYS-BLUE', '藍');
  const hitter = auditHolomen('AUDIT-HYS-HITTER', '黃', { damage: 40 });
  const pool = [...cards, dummy, ...coloredUnits, ...wrongColorUnits, white, green, red, blue, hitter];

  test(`${runtime.name}: hYS01-001–004 normal Oshi skills require the matching-color Collab before paying, then buff only that Collab by 20 for this turn`, () => {
    for (let index = 0; index < oshiRows.length; index += 1) {
      const [oshiNumber, color, colorWord] = oshiRows[index];
      const oshiCard = card(oshiNumber);
      assert.ok(oshiCard?.oshiSkill?.effect.includes(colorWord), `${oshiNumber} text names its matching color`);
      assert.match(oshiCard.oshiSkill.effect, /合作Holomen/u);
      assert.match(oshiCard.oshiSkill.effect, /\+20/u);

      let battle = main();
      battle.players[0].oshi = inst(oshiNumber);
      battle.players[0].zones.collab = unit(coloredUnits[index].number);
      battle.players[0].zones.back1 = unit(wrongColorUnits[index].number);
      battle.players[0].holoPower = [power(`${oshiNumber}-power-1`), power(`${oshiNumber}-power-2`)];
      assert.equal(isActionCandidateLegal(battle, 0, { type: 'oshiSkill' }, pool), true);
      battle = applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0);
      assert.equal(battle.players[0].holoPower.length, 0, `${oshiNumber} pays its printed two Power`);
      assert.equal(battle.players[0].archive.filter(instance => instance.id.startsWith(`${oshiNumber}-power-`)).length, 2);
      assert.ok(battle.players[0].zones.collab.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 20 && modifier.expiresTurn === battle.turn));
      assert.equal(battle.players[0].zones.back1.modifiers?.some(modifier => modifier.kind === 'arts' && modifier.amount === 20), false, 'the effect does not buff a matching-color Holomen outside Collab');

      battle.phase = 'performance';
      battle.players[1].zones.center = unit(dummy.number);
      battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 }, pool, () => 0);
      assert.equal(battle.players[1].zones.center.damage, 30, '10 printed Audit Arts plus the Collab Oshi modifier');
      battle.phase = 'main';
      assert.throws(() => applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0), /已使用/u, `${oshiNumber} is once per turn`);

      const invalid = main();
      invalid.players[0].oshi = inst(oshiNumber);
      invalid.players[0].zones.collab = unit(wrongColorUnits[index].number);
      invalid.players[0].holoPower = [power(`${oshiNumber}-invalid-1`), power(`${oshiNumber}-invalid-2`)];
      assert.equal(isActionCandidateLegal(invalid, 0, { type: 'oshiSkill' }, pool), false, `${oshiNumber} must not offer an impossible color target`);
      assert.throws(() => applyAction(invalid, 0, { type: 'oshiSkill' }, pool, () => 0), /合作 Holomen 不是/u);
      assert.equal(invalid.players[0].holoPower.length, 2, 'an invalid target must not consume Holo Power');
      assert.equal(Number(invalid.players[0].oshiSkillTurn || 0), 0, 'an invalid target must not spend the once-per-turn use');
    }
  });

  test(`${runtime.name}: hYS01-001 Quick Guard costs one Power, prevents exactly 20 only on White Holomen during the opponent turn, and is once per game`, () => {
    const build = target => {
      const battle = main();
      battle.phase = 'performance';
      battle.activePlayer = 1;
      battle.players[0].oshi = inst('hYS01-001');
      battle.players[0].zones.center = unit(target.number);
      battle.players[0].zones.back1 = unit(white.number);
      battle.players[0].holoPower = [power('quick-guard-power')];
      battle.players[1].zones.center = unit(hitter.number);
      return battle;
    };
    assert.match(card('hYS01-001').spOshiSkill.effect, /對手的回合.*白色Holomen.*傷害-20/u);

    let battle = build(white);
    battle = applyAction(battle, 1, attack, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'oshiDamageReaction');
    assert.ok(battle.pendingChoice.modeOptions.some(option => option.id === 'sp:20'));
    battle = choose(battle, 0, { optionId: 'sp:20' });
    assert.equal(battle.players[0].zones.center.damage, 20);
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.equal(battle.players[0].spOshiSkillUsed, true);
    battle.players[1].zones.center.rested = false;
    battle = applyAction(battle, 1, attack, pool, () => 0);
    assert.equal(battle.players[0].zones.center.damage, 60, 'subsequent White damage is not reduced after the once-per-game SP use');
    assert.notEqual(battle.pendingChoice?.effect, 'oshiDamageReaction');

    let offColor = build(green);
    offColor = applyAction(offColor, 1, attack, pool, () => 0);
    assert.equal(offColor.players[0].zones.center.damage, 40);
    assert.equal(offColor.players[0].holoPower.length, 1);
    assert.notEqual(offColor.pendingChoice?.effect, 'oshiDamageReaction', 'non-White Holomen cannot use Quick Guard');
  });

  test(`${runtime.name}: hYS01-002 SP restores 20 HP to every damaged Green Holomen and no other color`, () => {
    const oshiCard = card('hYS01-002');
    assert.match(oshiCard.spOshiSkill.effect, /所有綠色Holomen.*回復20/u);
    const battle = main();
    battle.players[0].oshi = inst(oshiCard.number);
    battle.players[0].holoPower = [power('green-relay-power')];
    battle.players[0].zones.center = unit(green.number, { damage: 45 });
    battle.players[0].zones.back1 = unit(green.number, { damage: 70 });
    battle.players[0].zones.collab = unit(green.number);
    battle.players[0].zones.back2 = unit(red.number, { damage: 80 });
    const result = applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0);
    assert.deepEqual([result.players[0].zones.center.damage, result.players[0].zones.back1.damage, result.players[0].zones.collab.damage, result.players[0].zones.back2.damage], [25, 50, 0, 80]);
    assert.equal(result.players[0].holoPower.length, 0);
    assert.equal(result.players[0].spOshiSkillUsed, true);
  });

  test(`${runtime.name}: hYS01-003 SP requires one archived Red Holomen and the selection cannot be skipped`, () => {
    const oshiCard = card('hYS01-003');
    assert.match(oshiCard.spOshiSkill.effect, /檔案區域.*1張紅色Holomen加入手牌/u);
    const noTarget = main();
    noTarget.players[0].oshi = inst(oshiCard.number);
    noTarget.players[0].holoPower = [power('red-relay-no-target-power')];
    noTarget.players[0].archive = [inst(blue.number, 'archived-blue'), inst(cards.find(candidate => candidate.group === 'cheer').number, 'archived-cheer')];
    assert.equal(isActionCandidateLegal(noTarget, 0, { type: 'spOshiSkill' }, pool), false, 'without a Red Holomen target, the mandatory SP effect is unavailable');
    assert.throws(() => applyAction(noTarget, 0, { type: 'spOshiSkill' }, pool, () => 0));
    assert.equal(noTarget.players[0].holoPower.length, 1, 'an unavailable mandatory effect cannot consume Power');
    assert.equal(Boolean(noTarget.players[0].spOshiSkillUsed), false);

    const battle = main();
    battle.players[0].oshi = inst(oshiCard.number);
    battle.players[0].holoPower = [power('red-relay-power')];
    battle.players[0].archive = [inst(red.number, 'archived-red'), inst(blue.number, 'archived-blue-control'), inst(cards.find(candidate => candidate.group === 'cheer').number, 'archived-cheer-control')];
    let result = applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0);
    assert.equal(result.pendingChoice?.effect, 'archiveToHand');
    assert.equal(result.pendingChoice?.optional, false);
    assert.deepEqual([result.pendingChoice.min, result.pendingChoice.max], [1, 1]);
    assert.deepEqual(result.pendingChoice.selectableIds, ['archived-red']);
    result = choose(result, 0, { cardIds: ['archived-red'] });
    assert.deepEqual(result.players[0].hand.map(instance => instance.id), ['archived-red']);
    assert.deepEqual(result.players[0].archive.map(instance => instance.id).sort(), ['archived-blue-control', 'archived-cheer-control', 'red-relay-power']);
    assert.equal(result.players[0].holoPower.length, 0);
    assert.equal(result.players[0].spOshiSkillUsed, true);
  });

  test(`${runtime.name}: hYS01-004 Backshot triggers on both Arts and Holomen-sourced special damage to opponent Back, then deals 50 there`, () => {
    assert.match(card('hYS01-004').spOshiSkill.effect, /Holomen對對手的後排Holomen造成傷害時.*50點特殊傷害/u);
    const build = () => {
      const battle = main();
      battle.players[0].oshi = inst('hYS01-004');
      battle.players[0].holoPower = [power('backshot-power')];
      battle.players[0].zones.center = unit(hitter.number);
      battle.players[0].zones.back1 = unit(blue.number);
      battle.players[1].zones.back1 = unit(green.number);
      return battle;
    };

    for (const kind of ['dealArtsDamage', 'specialDamage']) {
      let battle = build();
      battle.effectQueue = [kind === 'dealArtsDamage'
        ? { type: kind, playerIndex: 0, targetPlayerIndex: 1, targetZone: 'back1', sourceZone: 'center', damage: 15, amount: 15, sourceName: 'Audit Arts', artName: 'Audit Arts' }
        : { type: kind, playerIndex: 0, targetPlayerIndex: 1, targetZone: 'back1', sourceZone: 'center', amount: 15, loseLife: true, sourceName: 'Audit Holomen special damage' }];
      battle = applyAction(battle, 0, { type: 'advance' }, pool, () => 0);
      assert.equal(battle.players[1].zones.back1.damage, 15, `${kind} hit resolves before the optional SP follow-up`);
      assert.equal(battle.pendingChoice?.effect, 'oshiAfterDamage', `${kind} must reach the Oshi after-damage trigger`);
      assert.equal(battle.pendingChoice?.meta?.trigger, 'backshot');
      battle = choose(battle, 0, { optionId: 'use' });
      assert.equal(battle.players[1].zones.back1.damage, 65, `${kind} follow-up adds 50 special damage to that same Back Holomen`);
      assert.equal(battle.players[0].holoPower.length, 0, `${kind} consumes one Holo Power`);
      assert.equal(battle.players[0].spOshiSkillUsed, true);

      battle.phase = 'main';
      battle.players[1].zones.back2 = unit(blue.number);
      battle.effectQueue = [{ type: 'specialDamage', playerIndex: 0, targetPlayerIndex: 1, targetZone: 'back2', sourceZone: 'center', amount: 5, loseLife: true, sourceName: 'Audit follow-up' }];
      battle = applyAction(battle, 0, { type: 'advance' }, pool, () => 0);
      assert.equal(battle.players[1].zones.back2.damage, 5);
      assert.notEqual(battle.pendingChoice?.effect, 'oshiAfterDamage', 'the once-per-game Backshot cannot trigger a second time');
    }
  });
}
