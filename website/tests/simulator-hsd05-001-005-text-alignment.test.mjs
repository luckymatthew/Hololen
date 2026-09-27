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
  const controlAttacker = { ...dummy, number: 'AUDIT-ATTACKER', arts: [{ name: 'Audit attack', damage: 20, cost: [], effect: '' }] };
  const pool = [...cards, dummy, controlAttacker];
  const card = number => cards.find(candidate => candidate.number === number);
  const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);

  test(`${runtime.name}: hSD05-001 White Mic costs two Power and grants only the White Center +20 Arts for this turn`, () => {
    const oshi = card('hSD05-001');
    const debut = card('hSD05-004');
    assert.equal(oshi.oshiSkill.timingCode, 'once_per_turn');
    assert.match(oshi.oshiSkill.effect, /白色中置Holomen的藝術值\+20/u);
    assert.deepEqual([debut.arts[0].damage, debut.arts[0].cost], [40, ['白', '無色']]);

    let battle = main(debut.number);
    battle.players[0].oshi = inst(oshi.number);
    battle.players[0].holoPower = [inst('AUDIT-DUMMY', 'power-1'), inst('AUDIT-DUMMY', 'power-2')];
    battle = applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0);
    assert.deepEqual(new Set(battle.players[0].archive.map(instance => instance.id)), new Set(['power-1', 'power-2']));
    assert.ok(battle.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 20 && modifier.expiresTurn === battle.turn));

    battle.phase = 'performance';
    fund(battle.players[0].zones.center, debut.arts[0].cost);
    battle = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 60);
    battle.phase = 'main';
    assert.throws(() => applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0), /本回合已使用/u);
  });

  test(`${runtime.name}: hSD05-001 Quick Guard is an opponent-turn, White-Holomen, once-per-game 20-damage reduction`, () => {
    const oshi = card('hSD05-001');
    const target = card('hSD05-004');
    assert.equal(oshi.spOshiSkill.timingCode, 'once_per_game');
    assert.match(oshi.spOshiSkill.effect, /對手的回合.*白色Holomen受到對手傷害.*傷害-20/u);

    let battle = state();
    battle.phase = 'performance';
    battle.activePlayer = 0;
    battle.players[1].oshi = inst(oshi.number);
    battle.players[1].zones.center = unit(target.number);
    battle.players[1].zones.back1 = unit(target.number);
    battle.players[1].zones.collab = unit('AUDIT-DUMMY');
    battle.players[1].holoPower = [inst('AUDIT-DUMMY', 'quick-guard-power')];
    battle.effectQueue = [{ type: 'dealArtsDamage', playerIndex: 0, targetPlayerIndex: 1, targetZone: 'center', sourceZone: 'center', damage: 40, amount: 40, sourceName: 'Audit', artName: 'Audit' }];
    battle = applyAction(battle, 0, { ...attack, targetZone: 'collab' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'oshiDamageReaction');
    assert.ok(battle.pendingChoice.modeOptions.some(option => option.id === 'sp:20'));
    battle = applyAction(battle, 1, { type: 'choose', optionId: 'sp:20' }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 20);
    assert.equal(battle.players[1].holoPower.length, 0);
    assert.equal(battle.players[1].spOshiSkillUsed, true);

    battle.players[0].zones.center.rested = false;
    battle.effectQueue = [{ type: 'dealArtsDamage', playerIndex: 0, targetPlayerIndex: 1, targetZone: 'back1', sourceZone: 'center', damage: 40, amount: 40, sourceName: 'Audit', artName: 'Audit' }];
    const spent = applyAction(battle, 0, { ...attack, targetZone: 'collab' }, pool, () => 0);
    assert.equal(spent.players[1].zones.back1.damage, 40, 'without another SP use, damage applies in full to the next White Holomen');
    assert.equal(spent.players[1].spOshiSkillUsed, true);
    assert.notEqual(spent.pendingChoice?.effect, 'oshiDamageReaction');
  });

  test(`${runtime.name}: hSD05-002 unlimited Debut allows its printed copy count and deals 30 for one Colorless`, () => {
    const debut = card('hSD05-002');
    assert.equal(debut.stage, 'Debut');
    assert.equal(debut.unlimited, true);
    assert.equal(debut.maxCopies, 99);
    assert.match(debut.extra, /任意張數/u);
    assert.deepEqual([debut.arts[0].damage, debut.arts[0].cost], [30, ['無色']]);
    let battle = main(debut.number);
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, debut.arts[0].cost);
    battle = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 30);
  });

  test(`${runtime.name}: hSD05-003 Collab buffs only own #ReGLOSS Center +10 this turn`, () => {
    const collab = card('hSD05-003');
    const center = card('hSD05-004');
    assert.match(collab.keyword.effect, /#ReGLOSS.*中央.*Arts\+10/u);

    let battle = main(center.number);
    battle.players[0].zones.back1 = unit(collab.number);
    battle.players[0].mainDeck = [inst('AUDIT-DUMMY', 'collab-power')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.ok(battle.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 10 && modifier.sourceNumber === collab.number));
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, center.arts[0].cost);
    battle = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 50);

    let ineligible = main('hSD04-005');
    ineligible.players[0].zones.back1 = unit(collab.number);
    ineligible.players[0].mainDeck = [inst('AUDIT-DUMMY', 'non-regloss-collab-power')];
    ineligible = applyAction(ineligible, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(ineligible.players[0].zones.center.modifiers.some(modifier => modifier.sourceNumber === collab.number), false);
  });

  test(`${runtime.name}: hSD05-004/005 Arts values and costs match their printed basic actions`, () => {
    const debut = card('hSD05-004');
    const first = card('hSD05-005');
    assert.deepEqual(debut.arts.map(art => [art.damage, art.cost]), [[40, ['白', '無色']]]);
    assert.deepEqual(first.arts.map(art => [art.damage, art.cost]), [[40, ['白']], [60, ['無色', '無色']]]);

    let battle = main(debut.number);
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, debut.arts[0].cost);
    battle = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 40);

    battle = main(first.number);
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, first.arts[0].cost);
    battle = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 40);
    battle = main(first.number);
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, first.arts[1].cost);
    battle = applyAction(battle, 0, { ...attack, artIndex: 1 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 60);
  });
}
