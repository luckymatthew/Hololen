import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction, validateBattleDeck as websiteValidateBattleDeck } from '../lib/simulator/engine.mjs';
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
  const act = (battle, action, playerIndex = 0) => applyAction(battle, playerIndex, action, pool, () => 0);
  const choose = (battle, playerIndex, action) => act(battle, { type: 'choose', ...action }, playerIndex);
  const main = source => { const battle = state(source); battle.phase = 'main'; return battle; };
  const performance = source => { const battle = state(source); battle.phase = 'performance'; return battle; };

  test(`${runtime.name}: hSD13-007 Arts scales by its attached Cheer and gets +50 against Purple`, () => {
    let battle = performance('hSD13-007');
    const source = battle.players[0].zones.center;
    source.cheer = [inst('hY03-001', 'arts-red'), inst('hY01-001', 'arts-cheer-2'), inst('hY01-001', 'arts-cheer-3'), inst('hY01-001', 'arts-cheer-4')];
    battle.players[1].zones.center = unit('hBP02-064');

    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(battle.players[1].zones.center.damage, 230, '100 base + 4 × 20 per attached Cheer + 50 against Purple');
  });

  test(`${runtime.name}: hSD13-007 Arts knockout attaches only the Cheer Deck top to its attacker`, () => {
    let battle = performance('hSD13-007');
    battle.players[0].zones.center.cheer = [inst('hY03-001', 'ko-red'), inst('hY01-001', 'ko-cheer-2'), inst('hY01-001', 'ko-cheer-3'), inst('hY01-001', 'ko-cheer-4')];
    battle.players[0].cheerDeck = [inst('hY04-001', 'ko-top'), inst('hY05-001', 'ko-next')];
    battle.players[1].zones.center = unit(dummy.number, { damage: dummy.hp - 180 });
    battle.players[1].zones.collab = unit('hSD13-003');

    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(battle.players[1].zones.center, null, 'four attached Cheer raise this Arts to 180 and knock out the 10,000-HP fixture');
    for (let step = 0; battle.pendingChoice && step < 4; step += 1) {
      if (battle.pendingChoice.type === 'lifeCheerTarget') {
        battle = choose(battle, 1, { zone: 'collab' });
      } else if (battle.pendingChoice.type === 'eventCheerTarget') {
        assert.equal(battle.pendingChoice.playerIndex, 0);
        assert.deepEqual(battle.pendingChoice.options, ['center']);
        battle = choose(battle, 0, { zone: 'center' });
      } else {
        assert.fail(`Unexpected knockout follow-up: ${battle.pendingChoice.type}`);
      }
    }
    assert.equal(battle.pendingChoice, null, 'knockout follow-ups resolve');
    assert.deepEqual(battle.players[0].zones.center.cheer.map(instance => instance.id), ['ko-red', 'ko-cheer-2', 'ko-cheer-3', 'ko-cheer-4', 'ko-top']);
    assert.deepEqual(battle.players[0].cheerDeck.map(instance => instance.id), ['ko-next'], 'exactly one top Cheer is consumed');
  });

  test(`${runtime.name}: hSD13-007 Gift adds 10 HP per Cheer and changes the knockout threshold`, () => {
    const hit = withCheer => {
      let battle = state();
      battle.phase = 'performance';
      battle.activePlayer = 1;
      battle.players[0].zones.center = unit('hSD13-007', { damage: 170, cheer: withCheer ? [inst('hY01-001', 'gift-cheer')] : [] });
      battle.players[1].zones.center = unit('hBP01-016');
      fund(battle.players[1].zones.center, card('hBP01-016').arts[0].cost);
      return act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, 1);
    };
    const boosted = hit(true);
    assert.ok(boosted.players[0].zones.center, 'one Cheer raises Elizabeth to 190 HP, so 180 damage does not knock her out');
    assert.equal(boosted.players[0].zones.center.damage, 180);
    const unboosted = hit(false);
    assert.equal(unboosted.players[0].zones.center, null, 'without Cheer, 180 damage knocks out the 180-HP base unit');
  });

  test(`${runtime.name}: hSD13-008 unlimited deck copies and Colorless Arts match the card text`, () => {
    const deck = {
      oshi: { 'hSD13-001': 1 },
      main: { 'hSD13-008': 5, 'hSD13-003': 45 },
      cheer: { 'hY01-001': 20 },
    };
    assert.equal(card('hSD13-008').unlimited, true);
    assert.match(card('hSD13-008').extra, /任意張數/u);
    assert.equal(validateBattleDeck(deck, cards).ok, true, 'five Gigi copies are permitted by actual deck validation');

    const arts = card('hSD13-008').arts[0];
    assert.deepEqual([arts.damage, arts.cost], [20, ['無色']]);
    let battle = performance('hSD13-008');
    fund(battle.players[0].zones.center, arts.cost);
    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(battle.players[1].zones.center.damage, 20);
  });

  test(`${runtime.name}: hSD13-008 Collab moves one archived Cheer to an own #Justice Holomen only`, () => {
    let battle = main('hSD13-003');
    battle.players[0].zones.center = unit('hSD13-003');
    battle.players[0].zones.back1 = unit('hSD13-008');
    battle.players[0].zones.back2 = unit('hSD11-007');
    battle.players[0].archive = [inst('hY02-001', 'justice-archive-cheer'), inst('hY03-001', 'second-archive-cheer'), inst('hSD13-011', 'archive-holomem')];

    battle = act(battle, { type: 'collab', zone: 'back1' });
    assert.equal(battle.pendingChoice?.effect, 'archiveCheerToStage');
    assert.deepEqual(battle.pendingChoice.selectableIds, ['justice-archive-cheer', 'second-archive-cheer'], 'the effect selects archived Cheer, not archived Holomen');
    assert.equal(battle.pendingChoice.max, 1, 'the text moves one Cheer');
    battle = choose(battle, 0, { cardIds: ['justice-archive-cheer'] });
    assert.equal(battle.pendingChoice?.effect, 'attachArchiveCheer');
    assert.deepEqual(battle.pendingChoice.options, ['center', 'collab'], 'both own #Justice positions are legal; the non-Justice Back is excluded');
    battle = choose(battle, 0, { zone: 'center' });
    assert.ok(battle.players[0].zones.center.cheer.some(instance => instance.id === 'justice-archive-cheer'));
    assert.equal(battle.players[0].archive.some(instance => instance.id === 'justice-archive-cheer'), false);
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'second-archive-cheer'), 'an unselected archived Cheer stays in the Archive');
    assert.equal(battle.players[0].zones.back2.cheer.length, 0, 'the non-Justice target receives no Cheer');
  });

  test(`${runtime.name}: hSD13-009 Arts deals 20 and its Collab searches one #Justice 1st onto the Back`, () => {
    const arts = card('hSD13-009').arts[0];
    assert.deepEqual([arts.damage, arts.cost], [20, ['無色']]);
    let attackBattle = performance('hSD13-009');
    fund(attackBattle.players[0].zones.center, arts.cost);
    attackBattle = act(attackBattle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(attackBattle.players[1].zones.center.damage, 20);

    let battle = main('hSD13-003');
    battle.firstPlayer = 0;
    battle.activePlayer = 1;
    battle.players[1].turnsTaken = 1;
    battle.players[1].zones.center = unit('hSD13-003');
    battle.players[1].zones.back1 = unit('hSD13-009');
    battle.players[1].mainDeck = [inst('hSD13-003', 'power-top'), inst('hSD13-011', 'justice-1st'), inst('hSD13-003', 'justice-debut-not-eligible')];

    battle = act(battle, { type: 'collab', zone: 'back1' }, 1);
    assert.equal(battle.pendingChoice?.effect, 'deckCardsToStage');
    assert.equal(battle.pendingChoice.min, 0, 'a hidden-deck search permits failing to find a card');
    assert.equal(battle.pendingChoice.nonEmptyMin, 1, 'if the search selects a card, it selects exactly one');
    assert.equal(battle.pendingChoice.max, 1);
    assert.equal(battle.pendingChoice.optional, false);
    assert.deepEqual(battle.pendingChoice.cards.map(instance => instance.id), ['justice-1st'], 'the search excludes a Justice Debut and accepts the Justice 1st');
    battle = choose(battle, 1, { cardIds: ['justice-1st'] });
    assert.equal(battle.pendingChoice?.type, 'stageTarget');
    assert.deepEqual(battle.pendingChoice.options, ['back1', 'back2', 'back3', 'back4', 'back5']);
    battle = choose(battle, 1, { zone: 'back1' });
    assert.equal(card(battle.players[1].zones.back1.stack.at(-1).number).stage, '1st');
    assert.equal(battle.players[1].zones.back1.stack.at(-1).number, 'hSD13-011');
    assert.equal(battle.players[1].mainDeck.some(instance => instance.id === 'justice-1st'), false);
    assert.equal(battle.players[1].holoPower[0]?.id, 'power-top', 'Collab still pays its normal top-card Holo Power cost');
  });

  test(`${runtime.name}: hSD13-009 search is unavailable to the first player or after their first turn`, () => {
    for (const scenario of [{ firstPlayer: 1, turnsTaken: 1 }, { firstPlayer: 0, turnsTaken: 2 }]) {
      let battle = main('hSD13-003');
      battle.firstPlayer = scenario.firstPlayer;
      battle.activePlayer = 1;
      battle.players[1].turnsTaken = scenario.turnsTaken;
      battle.players[1].zones.center = unit('hSD13-003');
      battle.players[1].zones.back1 = unit('hSD13-009');
      battle.players[1].mainDeck = [inst('hSD13-003', `power-${scenario.firstPlayer}-${scenario.turnsTaken}`), inst('hSD13-011', `candidate-${scenario.firstPlayer}-${scenario.turnsTaken}`)];
      battle = act(battle, { type: 'collab', zone: 'back1' }, 1);
      assert.equal(battle.pendingChoice, null, `no search for firstPlayer=${scenario.firstPlayer}, turnsTaken=${scenario.turnsTaken}`);
      assert.equal(battle.players[1].zones.back1, null, 'the ordinary Collab still occurs');
    }
  });
}
