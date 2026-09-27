import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  applyAction as websiteApplyAction,
  isActionCandidateLegal as websiteIsActionCandidateLegal,
} from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, state, unit, inst, fund, attack } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, isActionCandidateLegal: websiteIsActionCandidateLegal, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const catalog = JSON.parse(readFileSync(androidCardsUrl, 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, isActionCandidateLegal: engine.isActionCandidateLegal, cards: catalog });
}
for (const runtime of runtimes) runtime.pool = [...runtime.cards, dummy];

const choose = (runtime, battle, action, random = () => 0) => runtime.applyAction(battle, 0, { type: 'choose', ...action }, runtime.pool, random);

for (const runtime of runtimes) {
  const { applyAction, isActionCandidateLegal, cards, pool } = runtime;

  test(`${runtime.name}: hSD01-001 normal Oshi skill moves one paid Cheer to another own Holomem`, () => {
    let battle = state('hSD01-003');
    battle.phase = 'main';
    battle.players[0].oshi = inst('hSD01-001', 'sora-oshi');
    battle.players[0].holoPower = [inst('AUDIT-DUMMY', 'power-cost')];
    battle.players[0].zones.center.cheer = [inst('hY01-001', 'move-this-cheer')];
    battle.players[0].zones.back1 = unit('hSD01-004');

    assert.equal(isActionCandidateLegal(battle, 0, { type: 'oshiSkill' }, pool), true);
    battle = applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'oshiMoveCheerSource');
    battle = choose(runtime, battle, { cheerId: 'move-this-cheer' });
    assert.equal(battle.pendingChoice?.effect, 'oshiMoveCheerTarget');
    assert.deepEqual(battle.pendingChoice.options, ['back1'], 'the source Holomem cannot be its own move destination');
    battle = choose(runtime, battle, { zone: 'back1' });

    assert.equal(battle.players[0].zones.center.cheer.length, 0);
    assert.deepEqual(battle.players[0].zones.back1.cheer.map(card => card.id), ['move-this-cheer']);
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.equal(battle.players[0].archive.filter(card => card.id === 'power-cost').length, 1);
    assert.equal(battle.players[0].oshiSkillTurn, battle.turn);
    assert.equal(isActionCandidateLegal(battle, 0, { type: 'oshiSkill' }, pool), false, 'once-per-turn use is recorded');
  });

  test(`${runtime.name}: hSD01-001 SP swaps the selected opponent Back with Center and buffs a White own Center`, () => {
    let battle = state('hSD01-003');
    battle.phase = 'main';
    battle.players[0].oshi = inst('hSD01-001', 'sora-oshi');
    battle.players[0].holoPower = [inst('AUDIT-DUMMY', 'power-1'), inst('AUDIT-DUMMY', 'power-2')];
    battle.players[1].zones.center = unit('hSD01-004');
    battle.players[1].zones.back1 = unit('hSD01-005');
    const opponentCenter = battle.players[1].zones.center;
    const opponentBack = battle.players[1].zones.back1;

    assert.equal(isActionCandidateLegal(battle, 0, { type: 'spOshiSkill' }, pool), true);
    battle = applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'oshiStarterSwap');
    assert.deepEqual(battle.pendingChoice.options, ['back1']);
    battle = choose(runtime, battle, { zone: 'back1' });

    assert.equal(battle.players[1].zones.center.stack.at(-1).number, opponentBack.stack.at(-1).number);
    assert.equal(battle.players[1].zones.back1.stack.at(-1).number, opponentCenter.stack.at(-1).number);
    assert.equal(battle.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 50 && modifier.expiresTurn === battle.turn), true);
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.equal(battle.players[0].spOshiSkillUsed, true);
    assert.equal(isActionCandidateLegal(battle, 0, { type: 'spOshiSkill' }, pool), false, 'SP is once per game');
  });

  test(`${runtime.name}: hSD01-001 SP still swaps when own Center is not White, without granting the White bonus`, () => {
    const greenCenter = cards.find(card => card.group === 'holomem' && card.colors.includes('綠'));
    assert.ok(greenCenter, 'catalog needs a Green Holomem for the conditional check');
    let battle = state(greenCenter.number);
    battle.phase = 'main';
    battle.players[0].oshi = inst('hSD01-001', 'sora-oshi');
    battle.players[0].holoPower = [inst('AUDIT-DUMMY', 'power-1'), inst('AUDIT-DUMMY', 'power-2')];
    battle.players[1].zones.center = unit('hSD01-004');
    battle.players[1].zones.back1 = unit('hSD01-005');
    battle = applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0);
    battle = choose(runtime, battle, { zone: 'back1' });

    assert.equal(battle.players[1].zones.center.stack.at(-1).number, 'hSD01-005');
    assert.equal(battle.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 50), false);
  });

  test(`${runtime.name}: hSD01-002 normal Oshi declares the next ability die and pays three Holo Power once`, () => {
    let battle = state('hBP01-043');
    const arts = cards.find(card => card.number === 'hBP01-043').arts[0];
    fund(battle.players[0].zones.center, arts.cost);
    battle.players[0].oshi = inst('hSD01-002', 'azki-oshi');
    battle.players[0].holoPower = [1, 2, 3].map(index => inst('AUDIT-DUMMY', `power-${index}`));
    let calls = 0;
    const rng = () => { calls += 1; return 0.99; };

    battle = applyAction(battle, 0, attack, pool, rng);
    assert.equal(battle.pendingChoice?.effect, 'firstSetArtsRoll');
    battle = choose(runtime, battle, { optionId: 'roll' });
    assert.equal(battle.pendingChoice?.effect, 'interactiveDice');
    assert.equal(calls, 0, 'declared die is chosen before the ability consumes randomness');
    battle = choose(runtime, battle, { optionId: 'declare:1' }, rng);

    assert.equal(calls, 3);
    assert.deepEqual(battle.players[0].turnEvents.dice.map(die => die.value), [1, 6, 6]);
    assert.equal(battle.players[1].zones.center.damage, 70);
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.equal(battle.players[0].archive.filter(card => card.id.startsWith('power-')).length, 3);
    assert.equal(battle.players[0].oshiSkillTurn, battle.turn);
  });

  test(`${runtime.name}: hSD01-002 SP selects any number of archived Cheer for one Green Holomem only`, () => {
    const green = cards.find(card => card.group === 'holomem' && card.colors.includes('綠'));
    const nonCheer = cards.find(card => card.group === 'support');
    assert.ok(green && nonCheer, 'catalog needs a Green Holomem and a non-Cheer archive card');

    const makeBattle = () => {
      const battle = state('hSD01-003');
      battle.phase = 'main';
      battle.players[0].oshi = inst('hSD01-002', 'azki-oshi');
      battle.players[0].holoPower = [1, 2, 3].map(index => inst('AUDIT-DUMMY', `power-${index}`));
      battle.players[0].zones.center = unit(green.number);
      battle.players[0].zones.back1 = unit('hSD01-003');
      return battle;
    };

    let battle = makeBattle();
    battle.players[0].archive = [
      inst('hY01-001', 'white-archived-cheer'),
      inst('hY02-001', 'green-archived-cheer'),
      inst(nonCheer.number, 'archive-non-cheer'),
    ];
    battle = applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'oshiArchiveCheerFixedTarget');
    assert.deepEqual(battle.pendingChoice.options, ['center'], 'only the Green Holomem is a legal recipient');
    battle = choose(runtime, battle, { zone: 'center' });
    assert.equal(battle.pendingChoice?.min, 0, 'any number includes choosing no archived Cheer');
    assert.equal(battle.pendingChoice?.max, 2);
    assert.deepEqual(new Set(battle.pendingChoice.cards.map(card => card.id)), new Set(['white-archived-cheer', 'green-archived-cheer']));
    battle = choose(runtime, battle, { cardIds: ['white-archived-cheer', 'green-archived-cheer'] });
    assert.equal(battle.pendingChoice?.effect, 'attachArchiveCheer');
    assert.deepEqual(battle.pendingChoice.options, ['center']);
    battle = choose(runtime, battle, { zone: 'center' });
    assert.equal(battle.pendingChoice?.effect, 'attachArchiveCheer');
    assert.deepEqual(battle.pendingChoice.options, ['center']);
    battle = choose(runtime, battle, { zone: 'center' });
    assert.equal(battle.pendingChoice, null);
    assert.deepEqual(new Set(battle.players[0].zones.center.cheer.map(card => card.id)), new Set(['white-archived-cheer', 'green-archived-cheer']));
    assert.ok(battle.players[0].archive.some(card => card.id === 'archive-non-cheer'));
    assert.equal(battle.players[0].spOshiSkillUsed, true);
    assert.equal(battle.players[0].holoPower.length, 0);

    battle = makeBattle();
    battle.players[0].archive = [inst(nonCheer.number, 'archive-only-non-cheer')];
    battle = applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0);
    battle = choose(runtime, battle, { zone: 'center' });
    assert.equal(battle.pendingChoice, null, 'with no archived Cheer the optional attach step is omitted');
    assert.equal(battle.players[0].zones.center.cheer.length, 0);
    assert.ok(battle.players[0].archive.some(card => card.id === 'archive-only-non-cheer'));
  });

  test(`${runtime.name}: hSD01-003 one Colorless Cheer pays for its 30-damage Arts`, () => {
    let battle = state('hSD01-003');
    assert.deepEqual(cards.find(card => card.number === 'hSD01-003').arts[0].cost, ['無色']);
    assert.equal(cards.find(card => card.number === 'hSD01-003').arts[0].damage, 30);
    assert.throws(() => applyAction(battle, 0, attack, pool, () => 0), /應援不足/u);
    fund(battle.players[0].zones.center, ['無色']);
    battle = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 30);
  });
}
