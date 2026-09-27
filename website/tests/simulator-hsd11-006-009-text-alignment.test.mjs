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
  const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);

  test(`${runtime.name}: hSD11-006 performance Gift optionally archives a hand #FLOW GLOW card and attaches Archive Yellow Cheer only to Niko`, () => {
    const makeBattle = () => {
      const battle = state('hSD11-006');
      battle.phase = 'main';
      // state(source) already places the source in Center; keep just the intended Back Gift source.
      battle.players[0].zones.center = unit('hSD11-007');
      battle.players[0].zones.back1 = unit('hSD11-006');
      battle.players[0].zones.back2 = unit('hSD11-003');
      battle.players[0].hand = [inst('hSD11-007', 'flow-glow-cost'), inst('hBP01-014', 'non-flow-glow')];
      battle.players[0].archive = [inst('hY06-001', 'yellow'), inst('hY01-001', 'white')];
      return battle;
    };
    let battle = applyAction(makeBattle(), 0, { type: 'advance' }, pool, () => 0);
    assert.equal(battle.phase, 'performance');
    assert.equal(battle.pendingChoice?.effect, 'giftFlowGlowPerformanceCost');
    assert.equal(battle.pendingChoice.optional, true);
    assert.deepEqual(battle.pendingChoice.cards.map(instance => instance.id), ['flow-glow-cost']);
    battle = choose(battle, { cardIds: ['flow-glow-cost'] });
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'flow-glow-cost'));
    assert.equal(battle.pendingChoice?.effect, 'archiveCheerToStage');
    assert.deepEqual(battle.pendingChoice.cards.map(instance => instance.id), ['yellow']);
    battle = choose(battle, { cardIds: ['yellow'] });
    assert.deepEqual(battle.pendingChoice?.options, ['back1', 'back2']);
    battle = choose(battle, { zone: 'back2' });
    assert.deepEqual(battle.players[0].zones.back2.cheer.map(instance => instance.id), ['yellow']);
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'white'), 'non-Yellow Archive Cheer is not eligible');

    let skipped = applyAction(makeBattle(), 0, { type: 'advance' }, pool, () => 0);
    skipped = choose(skipped, { skip: true });
    assert.ok(skipped.players[0].hand.some(instance => instance.id === 'flow-glow-cost'));
    assert.ok(skipped.players[0].archive.some(instance => instance.id === 'yellow'));
    assert.equal(skipped.players[0].zones.back2.cheer.length, 0);
  });

  test(`${runtime.name}: hSD11-006 Arts gains +40 per Cheer archived and its printed Red-target +50 remains`, () => {
    const niko = card('hSD11-006');
    const redTarget = cards.find(candidate => candidate.group === 'holomem' && candidate.colors?.includes('紅') && Number(candidate.hp || 0) >= 200);
    assert.ok(redTarget, 'catalog needs a Red target for the printed special-target value');
    assert.deepEqual(niko.arts[0].specialTargets, ['紅']);
    assert.deepEqual(niko.arts[0].specialValues, [50]);
    let battle = state(niko.number);
    battle.players[0].oshi = inst('hSD11-001', 'tiger-oshi');
    battle.players[0].holoPower = [inst(dummy.number, 'sp-1'), inst(dummy.number, 'sp-2')];
    fund(battle.players[0].zones.center, niko.arts[0].cost);
    battle.players[0].zones.center.cheer.push(inst('hY01-001', 'extra-1'), inst('hY02-001', 'extra-2'));
    battle.players[1].zones.center = unit(redTarget.number);

    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'artArchiveCheerCost');
    assert.equal(battle.pendingChoice.optional, true, 'zero archived Cheer is allowed');
    battle = choose(battle, { cheerId: 'extra-1' });
    assert.equal(battle.pendingChoice?.effect, 'artArchiveCheerCost');
    battle = choose(battle, { cheerId: 'extra-2' });
    assert.equal(battle.pendingChoice?.effect, 'artArchiveCheerCost', 'the optional any-number cost remains open while Cheer is available');
    battle = choose(battle, { skip: true });
    assert.equal(battle.pendingChoice?.effect, 'hSD11FlowGlowArchiveSp');
    assert.equal(battle.pendingChoice.meta.amount, 60, 'the Oshi trigger counts both Cheer archived by this ability');
    battle = choose(battle, { skip: true });
    assert.equal(battle.players[1].zones.center.damage, 40 + 80 + 50);
    assert.deepEqual(new Set(battle.players[0].archive.filter(instance => ['extra-1', 'extra-2'].includes(instance.id)).map(instance => instance.id)), new Set(['extra-1', 'extra-2']));
  });

  test(`${runtime.name}: hSD11-007 unlimited Debut copies validate and its Arts grants Center Baton +1 through the next opponent turn`, () => {
    const shu = card('hSD11-007');
    assert.equal(shu.unlimited, true);
    assert.equal(shu.maxCopies, 99);
    const deck = { oshi: { 'hSD11-001': 1 }, main: { 'hSD11-007': 5, 'hSD11-002': 45 }, cheer: { 'hY01-001': 20 } };
    assert.deepEqual(validateBattleDeck(deck, pool), { ok: true });

    let battle = state(shu.number);
    fund(battle.players[0].zones.center, shu.arts[0].cost);
    battle.players[1].zones.center = unit('hSD11-006');
    battle.players[1].zones.collab = unit('hSD11-003');
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'collab', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.collab.damage, 20);
    assert.deepEqual(battle.players[1].zones.center.modifiers.filter(modifier => modifier.kind === 'batonCost').map(({ amount, expiresTurn }) => ({ amount, expiresTurn })), [{ amount: 1, expiresTurn: battle.turn + 1 }]);
  });

  test(`${runtime.name}: hSD11-008 Collab gives the opposing Center Baton +1 through the next opponent turn`, () => {
    let battle = state('hSD11-008');
    battle.phase = 'main';
    battle.players[0].zones.back1 = unit('hSD11-008');
    battle.players[1].zones.center = unit('hSD11-006');
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.deepEqual(battle.players[1].zones.center.modifiers.filter(modifier => modifier.kind === 'batonCost').map(({ amount, expiresTurn }) => ({ amount, expiresTurn })), [{ amount: 1, expiresTurn: battle.turn + 1 }]);
  });

  test(`${runtime.name}: hSD11-008 Arts attaches the top Cheer to own Back only when its target Baton cost is at least two`, () => {
    const shu = card('hSD11-008');
    const attackAt = opponentNumber => {
      const battle = state(shu.number);
      battle.players[0].zones.back1 = unit('hSD11-002');
      battle.players[0].zones.back2 = unit('hSD11-003');
      battle.players[1].zones.center = unit(opponentNumber);
      battle.players[0].cheerDeck = [inst('hY01-001', 'top-cheer'), inst('hY02-001', 'next-cheer')];
      fund(battle.players[0].zones.center, shu.arts[0].cost);
      return applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    };
    let battle = attackAt('hSD11-006');
    assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
    assert.deepEqual(battle.pendingChoice.options, ['back1', 'back2']);
    battle = choose(battle, { zone: 'back2' });
    assert.equal(battle.players[1].zones.center.damage, 30);
    assert.deepEqual(battle.players[0].zones.back2.cheer.map(instance => instance.id), ['top-cheer']);
    assert.deepEqual(battle.players[0].cheerDeck.map(instance => instance.id), ['next-cheer']);

    const belowThreshold = attackAt('hSD11-007');
    assert.equal(belowThreshold.players[1].zones.center.damage, 30);
    assert.equal(belowThreshold.pendingChoice, null);
    assert.equal(belowThreshold.players[0].cheerDeck.length, 2);
  });

  test(`${runtime.name}: hSD11-009 Collab gives the opposing Center Baton +3 through the next opponent turn`, () => {
    let battle = state('hSD11-009');
    battle.phase = 'main';
    battle.players[0].zones.back1 = unit('hSD11-009');
    battle.players[1].zones.center = unit('hSD11-006');
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.deepEqual(battle.players[1].zones.center.modifiers.filter(modifier => modifier.kind === 'batonCost').map(({ amount, expiresTurn }) => ({ amount, expiresTurn })), [{ amount: 3, expiresTurn: battle.turn + 1 }]);
  });

  test(`${runtime.name}: hSD11-009 Arts deals 10 special damage per target Baton and preserves the Purple Arts +50`, () => {
    const shu = card('hSD11-009');
    const cases = [
      { number: 'hSD11-007', expected: 110 },
      { number: 'hSD11-006', expected: 120 },
      { number: 'hBP02-047', expected: 170 },
    ];
    for (const { number, expected } of cases) {
      let battle = state(shu.number);
      fund(battle.players[0].zones.center, shu.arts[0].cost);
      battle.players[1].zones.center = unit(number);
      battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
      assert.equal(battle.players[1].zones.center.damage, expected, `${number}: normal Arts plus target-specific special damage`);
    }
  });
}
