import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction, validateBattleDeck as websiteValidateBattleDeck } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, fund, inst, state, unit } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, validateBattleDeck: websiteValidateBattleDeck, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const cards = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, validateBattleDeck: engine.validateBattleDeck, cards });
}

for (const runtime of runtimes) {
  const { applyAction, validateBattleDeck, cards } = runtime;
  const card = number => cards.find(candidate => candidate.number === number);
  const chihayaOshi = card('hSD10-001');
  const debut = card('hSD10-002');
  const first = card('hSD10-003');
  const giftedFirst = card('hSD10-004');
  const djFirst = card('hSD10-005');
  const second = card('hSD10-006');
  const flowMember = card('hSD10-007');
  const pool = [...cards, dummy];
  const choose = (battle, playerIndex, action) => applyAction(battle, playerIndex, { type: 'choose', ...action }, pool, () => 0);
  const main = () => { const battle = state(); battle.phase = 'main'; return battle; };
  const attack = (source, artIndex, cost) => {
    const battle = state();
    battle.phase = 'performance';
    battle.players[0].zones.center = unit(source.number);
    fund(battle.players[0].zones.center, cost);
    battle.players[1].zones.center = unit(dummy.number);
    return applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex }, pool, () => 0);
  };

  test(`${runtime.name}: hSD10-001 normal skill requires a Bloom this turn and gives one #FLOW GLOW +30 Arts`, () => {
    assert.ok(chihayaOshi?.oshiSkill);
    let battle = main();
    battle.players[0].oshi = inst(chihayaOshi.number);
    battle.players[0].zones.center = unit(debut.number);
    battle.players[0].zones.back1 = unit(first.number, { bloomedTurn: battle.turn });
    battle.players[0].holoPower = [inst(dummy.number, 'power-1'), inst(dummy.number, 'power-2')];
    battle = applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0);
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.deepEqual(battle.pendingChoice.options, ['center', 'back1']);
    battle = choose(battle, 0, { zone: 'center' });
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, debut.arts[0].cost);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, debut.arts[0].damage + 30);

    let noBloom = main();
    noBloom.players[0].oshi = inst(chihayaOshi.number);
    noBloom.players[0].zones.center = unit(debut.number);
    noBloom.players[0].holoPower = [inst(dummy.number, 'unused-1'), inst(dummy.number, 'unused-2')];
    assert.throws(() => applyAction(noBloom, 0, { type: 'oshiSkill' }, pool, () => 0), /尚未.*Bloom/u);
    assert.equal(noBloom.players[0].holoPower.length, 2);
  });

  test(`${runtime.name}: hSD10-001 SP attaches top Cheer first, then buffs a selected #FLOW GLOW by 20 per Cheer`, () => {
    let battle = main();
    battle.players[0].oshi = inst(chihayaOshi.number);
    battle.players[0].holoPower = [inst(dummy.number, 'sp-a'), inst(dummy.number, 'sp-b')];
    battle.players[0].zones.center = unit(debut.number, { cheer: [inst('hY01-001', 'old-1'), inst('hY03-001', 'old-2')] });
    battle.players[0].zones.back1 = unit(dummy.number);
    battle.players[0].cheerDeck = [inst('hY04-001', 'new-cheer'), inst('hY01-001', 'next-cheer')];
    battle = applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0);
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.equal(battle.players[0].spOshiSkillUsed, true);
    assert.deepEqual(battle.pendingChoice.options, ['center', 'back1']);
    battle = choose(battle, 0, { zone: 'back1' });
    assert.equal(battle.players[0].zones.back1.cheer[0].id, 'new-cheer');
    assert.equal(battle.pendingChoice.effect, 'oshiFlowGlowBuff');
    assert.deepEqual(battle.pendingChoice.options, ['center']);
    battle = choose(battle, 0, { zone: 'center' });
    assert.equal(battle.players[0].zones.center.modifiers.at(-1).amount, 40, 'the chosen target has two Cheer after the top Cheer was sent elsewhere');
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, debut.arts[0].cost);
    battle.players[1].zones.center = unit(dummy.number);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, debut.arts[0].damage + 40);
  });

  test(`${runtime.name}: hSD10-002 is an unlimited-copy Debut and has 30 damage for one Colorless`, () => {
    assert.equal(debut.unlimited, true);
    assert.equal(debut.stage, 'Debut');
    const fillers = [...new Map(cards.filter(candidate => ['holomem', 'support'].includes(candidate.group)
      && candidate.number !== debut.number).map(candidate => [candidate.number, candidate])).values()].slice(0, 45);
    assert.equal(fillers.length, 45);
    const mainDeck = Object.fromEntries(fillers.map(candidate => [candidate.number, 1]));
    mainDeck[debut.number] = 5;
    assert.deepEqual(validateBattleDeck({ oshi: { [chihayaOshi.number]: 1 }, main: mainDeck, cheer: { 'hY01-001': 20 } }, cards), { ok: true }, 'five copies exceed the usual four-copy limit as printed');
    const result = attack(debut, 0, debut.arts[0].cost);
    assert.equal(result.players[1].zones.center.damage, 30);
  });

  test(`${runtime.name}: hSD10-003 both printed Arts values and costs resolve`, () => {
    assert.deepEqual(first.arts.map(art => [art.damage, art.cost]), [[30, ['無色']], [80, ['綠', '無色', '無色']]]);
    assert.equal(attack(first, 0, first.arts[0].cost).players[1].zones.center.damage, 30);
    assert.equal(attack(first, 1, first.arts[1].cost).players[1].zones.center.damage, 80);
  });

  test(`${runtime.name}: hSD10-004 Arts sends top Cheer only with three #FLOW GLOW and targets a Back Holomen`, () => {
    assert.ok(giftedFirst?.keyword?.type === 'gift');
    const playArts = backCount => {
      let battle = state();
      battle.phase = 'performance';
      battle.players[0].zones.center = unit(debut.number);
      battle.players[0].zones.collab = unit(giftedFirst.number);
      if (backCount >= 1) battle.players[0].zones.back1 = unit(first.number);
      if (backCount >= 2) battle.players[0].zones.back2 = unit(djFirst.number);
      battle.players[1].zones.center = unit(dummy.number);
      battle.players[0].cheerDeck = [inst('hY01-001', 'top')];
      fund(battle.players[0].zones.collab, giftedFirst.arts[0].cost);
      return applyAction(battle, 0, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    };
    let battle = playArts(2);
    assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
    assert.ok(battle.pendingChoice.options.includes('back1'));
    assert.ok(!battle.pendingChoice.options.includes('center') && !battle.pendingChoice.options.includes('collab'));
    battle = choose(battle, 0, { zone: 'back1' });
    assert.equal(battle.players[1].zones.center.damage, giftedFirst.arts[0].damage);
    assert.equal(battle.players[0].zones.back1.cheer[0].id, 'top');
    const belowThreshold = playArts(0);
    assert.equal(belowThreshold.pendingChoice, null, 'two FLOW GLOW members do not meet the three-member condition');
    assert.equal(belowThreshold.players[1].zones.center.damage, giftedFirst.arts[0].damage);
    assert.equal(belowThreshold.players[0].cheerDeck.length, 1);
  });

  test(`${runtime.name}: hSD10-004 Gift enables one same-turn extra Bloom only with Chihaya Oshi and an opposing 1st`, () => {
    const giftState = ({ oshiNumber = chihayaOshi.number, opponentFirst = true, bloomed = true } = {}) => {
      let battle = main();
      battle.players[0].oshi = inst(oshiNumber);
      battle.players[0].turnsTaken = 2;
      battle.players[0].zones.center = unit(giftedFirst.number, {
        stack: [inst(debut.number, 'debut-under'), inst(giftedFirst.number, 'gifted-top')],
        enteredTurn: 1, bloomedTurn: bloomed ? battle.turn : 0,
      });
      if (opponentFirst) battle.players[1].zones.center = unit(first.number);
      battle.players[0].hand = [inst(second.number, 'second-in-hand')];
      return battle;
    };
    let battle = giftState();
    battle = applyAction(battle, 0, { type: 'giftSkill', zone: 'center', cardNumber: giftedFirst.number }, pool, () => 0);
    assert.equal(battle.pendingChoice.effect, 'bonusBloomCard');
    assert.equal(battle.pendingChoice.optional, true);
    assert.deepEqual(battle.pendingChoice.cards.map(instance => instance.id), ['second-in-hand']);
    battle = choose(battle, 0, { cardIds: ['second-in-hand'] });
    assert.deepEqual(battle.pendingChoice.options, ['center']);
    battle = choose(battle, 0, { zone: 'center' });
    assert.equal(battle.players[0].zones.center.stack.at(-1).number, second.number);
    assert.equal(battle.players[0].zones.center.bloomedTurn, battle.turn);
    assert.equal(battle.players[0].bonusBloomUsedTurn, battle.turn);

    assert.throws(() => applyAction(giftState({ oshiNumber: 'hSD09-001' }), 0,
      { type: 'giftSkill', zone: 'center', cardNumber: giftedFirst.number }, pool, () => 0), /輪堂千速/u);
    assert.throws(() => applyAction(giftState({ opponentFirst: false }), 0,
      { type: 'giftSkill', zone: 'center', cardNumber: giftedFirst.number }, pool, () => 0), /對手舞台/u);
    assert.throws(() => applyAction(giftState({ bloomed: false }), 0,
      { type: 'giftSkill', zone: 'center', cardNumber: giftedFirst.number }, pool, () => 0), /本回合已 Bloom/u);
  });

  test(`${runtime.name}: hSD10-005 Collab optionally bottoms 1–3 archived #FLOW GLOW then offers top Cheer for three`, () => {
    const returned = [debut.number, first.number, giftedFirst.number].map((number, index) => inst(number, `archive-${index}`));
    let battle = main();
    battle.players[0].zones.back1 = unit(djFirst.number);
    battle.players[0].mainDeck = [inst(dummy.number, 'collab-power'), inst(dummy.number, 'remain-1'), inst(dummy.number, 'remain-2')];
    battle.players[0].archive = [...returned, inst('hSD09-002', 'not-flow-glow')];
    battle.players[0].cheerDeck = [inst('hY04-001', 'top-cheer')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.optional, true);
    assert.deepEqual([battle.pendingChoice.min, battle.pendingChoice.max], [1, 3]);
    assert.deepEqual(new Set(battle.pendingChoice.cards.map(instance => instance.id)), new Set(returned.map(instance => instance.id)));
    battle = choose(battle, 0, { cardIds: ['archive-2', 'archive-0', 'archive-1'] });
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['remain-1', 'remain-2', 'archive-2', 'archive-0', 'archive-1']);
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'not-flow-glow'));
    assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
    assert.equal(battle.pendingChoice.optional, true);
    battle = choose(battle, 0, { zone: 'center' });
    assert.equal(battle.players[0].zones.center.cheer[0].id, 'top-cheer');

    let one = main();
    one.players[0].zones.back1 = unit(djFirst.number);
    one.players[0].archive = [inst(debut.number, 'one-flow'), inst('hSD09-002', 'one-non-flow')];
    one = applyAction(one, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    one = choose(one, 0, { cardIds: ['one-flow'] });
    assert.equal(one.pendingChoice, null, 'returning fewer than three does not trigger the Cheer attachment');
  });

  test(`${runtime.name}: hSD10-005 Arts grants +20 to a Chihaya only after any own Holomen Bloom this turn`, () => {
    const bloomAttack = bloomCount => {
      let battle = state();
      battle.phase = 'performance';
      battle.players[0].turnEvents = { turn: battle.turn, supports: [], arts: [], bloomCount, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
      battle.players[0].zones.center = unit(djFirst.number);
      battle.players[0].zones.collab = unit(first.number);
      battle.players[0].zones.back1 = unit(giftedFirst.number);
      battle.players[1].zones.center = unit(dummy.number);
      fund(battle.players[0].zones.center, djFirst.arts[0].cost);
      return applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    };
    const bloomed = bloomAttack(1);
    assert.equal(bloomed.pendingChoice, null, 'text names the Chihaya members receiving the modifier and makes no target selection');
    assert.equal(bloomed.players[1].zones.center.damage, djFirst.arts[0].damage + 20);
    assert.equal(bloomed.players[0].zones.collab.modifiers.at(-1).amount, 20);
    assert.equal(bloomed.players[0].zones.back1.modifiers.at(-1).amount, 20);
    const noBloom = bloomAttack(0);
    assert.equal(noBloom.pendingChoice, null);
    assert.equal(noBloom.players[1].zones.center.damage, djFirst.arts[0].damage);
    assert.equal(noBloom.players[0].zones.collab.modifiers.length, 0);
    assert.equal(noBloom.players[0].zones.back1.modifiers.length, 0);
  });
}
