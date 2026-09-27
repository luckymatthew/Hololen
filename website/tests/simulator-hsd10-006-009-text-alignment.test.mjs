import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction, publicRoomState as websitePublicRoomState, validateBattleDeck as websiteValidateBattleDeck } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, fund, inst, state, unit } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, publicRoomState: websitePublicRoomState, validateBattleDeck: websiteValidateBattleDeck, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const cards = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, publicRoomState: engine.publicRoomState, validateBattleDeck: engine.validateBattleDeck, cards });
}

for (const runtime of runtimes) {
  const { applyAction, publicRoomState, validateBattleDeck, cards } = runtime;
  const card = number => cards.find(candidate => candidate.number === number);
  const bloomSecond = card('hSD10-006');
  const vivDebut = card('hSD10-007');
  const vivFirst = card('hSD10-008');
  const vivSecond = card('hSD10-009');
  const whiteDummy = { ...dummy, number: 'AUDIT-HSD10-WHITE', colors: ['白'], hp: 200 };
  const blueDummy = { ...dummy, number: 'AUDIT-HSD10-BLUE', colors: ['藍'], hp: 10000 };
  const pool = [...cards, dummy, whiteDummy, blueDummy];
  const choose = (battle, playerIndex, action) => applyAction(battle, playerIndex, { type: 'choose', ...action }, pool, () => 0);
  const main = () => { const battle = state(); battle.phase = 'main'; return battle; };
  const attack = (attacker, artIndex, target, targetZone = 'center', bloomCount = 0) => {
    const battle = state();
    battle.phase = 'performance';
    battle.players[0].turnEvents = { turn: battle.turn, supports: [], arts: [], bloomCount, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
    battle.players[0].zones.center = unit(attacker.number);
    fund(battle.players[0].zones.center, attacker.arts[artIndex].cost);
    battle.players[1].zones.center = unit(target.number);
    return applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone, artIndex }, pool, () => 0);
  };

  test(`${runtime.name}: hSD10-006 first Arts adds 50 only after own Bloom and keeps the printed White bonus`, () => {
    assert.deepEqual([bloomSecond.arts[0].damage, bloomSecond.arts[0].cost, bloomSecond.arts[0].specialTargets, bloomSecond.arts[0].specialValues], [80, ['綠', '無色'], ['白'], [50]]);
    const bloomed = attack(bloomSecond, 0, whiteDummy, 'center', 1);
    const noBloom = attack(bloomSecond, 0, whiteDummy, 'center', 0);
    assert.equal(bloomed.players[1].zones.center.damage, 80 + 50 + 50);
    assert.equal(noBloom.players[1].zones.center.damage, 80 + 50);
  });

  test(`${runtime.name}: hSD10-006 second Arts grants one back Cheer per full 30 excess damage`, () => {
    assert.deepEqual([bloomSecond.arts[1].damage, bloomSecond.arts[1].cost, bloomSecond.arts[1].specialTargets, bloomSecond.arts[1].specialValues], [140, ['綠', '無色', '無色'], ['白'], [50]]);
    const resolve = excess => {
      let battle = state();
      battle.phase = 'performance';
      battle.players[0].zones.center = unit(bloomSecond.number);
      fund(battle.players[0].zones.center, bloomSecond.arts[1].cost);
      battle.players[0].zones.back1 = unit(dummy.number);
      battle.players[0].cheerDeck = [inst('hY03-001', 'overkill-1'), inst('hY04-001', 'overkill-2'), inst('hY01-001', 'overkill-3')];
      battle.players[1].zones.center = unit(whiteDummy.number, { damage: whiteDummy.hp - (190 - excess) });
      battle.players[1].zones.back1 = unit(dummy.number);
      battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 1 }, pool, () => 0);
      for (let count = 0; battle.pendingChoice && count < 12; count += 1) {
        const pending = battle.pendingChoice;
        if (pending.type === 'lifeCheerTarget') battle = choose(battle, 1, { zone: 'back1' });
        else if (pending.effect === 'hSD10OverkillCheerTarget') battle = choose(battle, 0, { zone: 'back1' });
        else if (pending.type === 'eventCheerTarget') battle = choose(battle, 0, { zone: 'back1' });
        else throw new Error(`Unexpected overkill follow-up: ${pending.effect || pending.type}`);
      }
      assert.equal(battle.players[1].zones.center, null, 'the White Center was knocked out');
      return battle;
    };
    let noKnockout = state();
    noKnockout.phase = 'performance';
    noKnockout.players[0].zones.center = unit(bloomSecond.number);
    fund(noKnockout.players[0].zones.center, bloomSecond.arts[1].cost);
    noKnockout.players[0].zones.back1 = unit(dummy.number);
    noKnockout.players[0].cheerDeck = [inst('hY03-001', 'no-ko-cheer')];
    noKnockout.players[1].zones.center = unit(whiteDummy.number);
    noKnockout = applyAction(noKnockout, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 1 }, pool, () => 0);
    assert.equal(noKnockout.pendingChoice, null, 'a surviving Center cannot start the knockout-only top-Cheer effect');
    assert.equal(noKnockout.players[0].cheerDeck[0].id, 'no-ko-cheer');

    for (const [excess, expected] of [[29, 0], [30, 1], [59, 1], [60, 2]]) {
      const battle = resolve(excess);
      assert.equal(battle.players[0].zones.back1.cheer.length, expected, `${excess} excess damage attaches ${expected}`);
      assert.equal(battle.players[0].cheerDeck.length, 3 - expected);
    }
  });

  test(`${runtime.name}: hSD10-007 is an unlimited-copy Debut with 20 damage for one Colorless`, () => {
    assert.equal(vivDebut.stage, 'Debut');
    assert.equal(vivDebut.unlimited, true);
    const fillers = [...new Map(cards.filter(candidate => ['holomem', 'support'].includes(candidate.group)
      && candidate.number !== vivDebut.number).map(candidate => [candidate.number, candidate])).values()].slice(0, 45);
    const mainDeck = Object.fromEntries(fillers.map(candidate => [candidate.number, 1]));
    mainDeck[vivDebut.number] = 5;
    assert.deepEqual(validateBattleDeck({ oshi: { 'hSD10-001': 1 }, main: mainDeck, cheer: { 'hY01-001': 20 } }, cards), { ok: true });
    const battle = attack(vivDebut, 0, dummy);
    assert.equal(battle.players[1].zones.center.damage, 20);
  });

  test(`${runtime.name}: hSD10-008 Arts is 30 Colorless and Collab privately shows all opponent cards then draws iff any is Support`, () => {
    assert.deepEqual([vivFirst.arts[0].damage, vivFirst.arts[0].cost], [30, ['無色']]);
    assert.equal(attack(vivFirst, 0, dummy).players[1].zones.center.damage, 30);
    const support = cards.find(candidate => candidate.group === 'support');
    const holomem = card('hSD10-002');
    assert.ok(support && holomem);
    const inspect = opponentHand => {
      let battle = main();
      battle.players[0].zones.back1 = unit(vivFirst.number);
      battle.players[1].hand = opponentHand;
      battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
      assert.equal(battle.pendingChoice?.effect, 'handInspection');
      const revealLabel = battle.pendingChoice.modeOptions[0].label;
      assert.ok(publicRoomState(battle, 0).pendingChoice.modeOptions[0].label.includes(String(holomem.name)), 'the acting player can inspect the opponent hand');
      const opponentView = publicRoomState(battle, 1);
      assert.deepEqual(opponentView.pendingChoice, { type: 'opponent', playerIndex: 0 });
      assert.equal(JSON.stringify(opponentView).includes(String(holomem.name)), false, 'the inspected card names are not sent to the non-acting player');
      battle = choose(battle, 0, { optionId: 'confirm' });
      return { battle, revealLabel };
    };
    const withSupport = inspect([inst(holomem.number, 'opponent-holomem'), inst(support.number, 'opponent-support')]);
    assert.ok(withSupport.revealLabel.includes(String(holomem.name)));
    assert.ok(withSupport.revealLabel.includes(String(support.name)));
    assert.equal(withSupport.battle.players[0].hand.length, 1);
    const withoutSupport = inspect([inst(holomem.number, 'only-holomem')]);
    assert.equal(withoutSupport.battle.players[0].hand.length, 0);
  });

  test(`${runtime.name}: hSD10-009 Collab reveals exactly opponent hand size, adds one and shuffles the rest`, () => {
    let battle = main();
    battle.players[0].zones.back1 = unit(vivSecond.number);
    battle.players[0].mainDeck = [inst(dummy.number, 'collab-power'), inst(dummy.number, 'look-one'), inst(dummy.number, 'look-two'), inst(dummy.number, 'outside-count')];
    battle.players[1].hand = [inst(vivDebut.number, 'opp-one'), inst(vivFirst.number, 'opp-two')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.players[0].holoPower[0].id, 'collab-power');
    assert.equal(battle.pendingChoice?.effect, 'topPickShuffleRest');
    assert.deepEqual(new Set(battle.pendingChoice.cards.map(instance => instance.id)), new Set(['look-one', 'look-two']));
    battle = choose(battle, 0, { cardIds: ['look-two'] });
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'look-two'));
    assert.deepEqual(new Set(battle.players[0].mainDeck.map(instance => instance.id)), new Set(['look-one', 'outside-count']));

    let zeroHand = main();
    zeroHand.players[0].zones.back1 = unit(vivSecond.number);
    zeroHand.players[0].mainDeck = [inst(dummy.number, 'zero-power'), inst(dummy.number, 'not-revealed')];
    zeroHand = applyAction(zeroHand, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(zeroHand.pendingChoice, null, 'an opponent with no hand cards reveals no cards');
    assert.deepEqual(zeroHand.players[0].mainDeck.map(instance => instance.id), ['not-revealed']);
  });

  test(`${runtime.name}: hSD10-009 Arts scales +10 per opponent card and retains the Blue +50`, () => {
    assert.deepEqual([vivSecond.arts[0].damage, vivSecond.arts[0].cost, vivSecond.arts[0].specialTargets, vivSecond.arts[0].specialValues], [80, ['紫', '無色'], ['藍'], [50]]);
    let battle = state();
    battle.phase = 'performance';
    battle.players[0].zones.center = unit(vivSecond.number);
    fund(battle.players[0].zones.center, vivSecond.arts[0].cost);
    battle.players[1].zones.center = unit(blueDummy.number);
    battle.players[1].hand = [inst(vivDebut.number, 'hand-1'), inst(vivFirst.number, 'hand-2')];
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 80 + 20 + 50);

    let empty = state();
    empty.phase = 'performance';
    empty.players[0].zones.center = unit(vivSecond.number);
    fund(empty.players[0].zones.center, vivSecond.arts[0].cost);
    empty.players[1].zones.center = unit(blueDummy.number);
    empty = applyAction(empty, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(empty.players[1].zones.center.damage, 80 + 50);
  });
}
