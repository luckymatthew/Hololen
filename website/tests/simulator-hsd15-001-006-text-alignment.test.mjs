import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, fund } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const catalog = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, cards: catalog });
}

for (const runtime of runtimes) {
  const { applyAction, cards } = runtime;
  const pool = [...cards, dummy, oshi];
  const card = number => cards.find(candidate => candidate.number === number);
  const act = (battle, action, playerIndex = 0) => applyAction(battle, playerIndex, action, pool, () => 0);
  const choose = (battle, action, playerIndex = 0) => act(battle, { type: 'choose', ...action }, playerIndex);
  const main = () => { const battle = state('hSD15-002', 'hSD15-003'); battle.phase = 'main'; return battle; };

  test(`${runtime.name}: hSD15-001 normal Oshi searches exactly one #きのこ event and shuffles`, () => {
    let battle = main();
    battle.players[0].oshi = inst('hSD15-001', 'raden-oshi-normal');
    battle.players[0].holoPower = [inst(dummy.number, 'raden-power-1'), inst(dummy.number, 'raden-power-2')];
    battle.players[0].mainDeck = [inst('hSD15-010', 'kinoko-deck-1'), inst('hBP04-094', 'kinoko-deck-2'), inst('hSD14-011', 'not-event')];

    battle = act(battle, { type: 'oshiSkill' });
    assert.equal(battle.pendingChoice?.effect, 'deckToHandShuffle');
    assert.equal(battle.pendingChoice.min, 0, 'hidden-deck searches may fail to find');
    assert.equal(battle.pendingChoice.nonEmptyMin, 1);
    assert.equal(battle.pendingChoice.max, 1);
    assert.deepEqual(new Set(battle.pendingChoice.cards.map(item => item.id)), new Set(['kinoko-deck-1', 'kinoko-deck-2']));
    battle = choose(battle, { cardIds: ['kinoko-deck-1'] });
    assert.deepEqual(battle.players[0].hand.map(item => item.id), ['kinoko-deck-1']);
    assert.equal(battle.players[0].mainDeck.some(item => item.id === 'not-event'), true);
    assert.equal(battle.players[0].holoPower.length, 0);
  });

  test(`${runtime.name}: hSD15-001 SP attaches top Cheer to own Raden before returning an Archive #きのこ event`, () => {
    let battle = main();
    battle.players[0].oshi = inst('hSD15-001', 'raden-oshi-sp');
    battle.players[0].holoPower = [inst(dummy.number, 'raden-sp-power-1'), inst(dummy.number, 'raden-sp-power-2')];
    battle.players[0].zones.center = unit('hSD15-002');
    battle.players[0].zones.back1 = unit('hSD15-003');
    battle.players[0].cheerDeck = [inst('hY01-001', 'raden-sp-cheer'), inst('hY02-001', 'raden-sp-cheer-tail')];
    battle.players[0].archive = [inst('hSD15-010', 'archive-kinoko'), inst('hSD14-011', 'archive-mascot')];

    battle = act(battle, { type: 'spOshiSkill' });
    assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
    assert.deepEqual(battle.pendingChoice.options, ['center', 'back1']);
    battle = choose(battle, { zone: 'center' });
    assert.deepEqual(battle.players[0].zones.center.cheer.map(item => item.id), ['raden-sp-cheer']);
    assert.equal(battle.pendingChoice?.effect, 'archiveToHand');
    assert.deepEqual(battle.pendingChoice.cards.map(item => item.id), ['archive-kinoko']);
    battle = choose(battle, { cardIds: ['archive-kinoko'] });
    assert.equal(battle.players[0].hand[0].id, 'archive-kinoko');
    assert.equal(battle.players[0].archive.some(item => item.id === 'archive-mascot'), true);
    assert.equal(battle.players[0].spOshiSkillUsed, true);
    assert.equal(battle.players[0].holoPower.length, 0);
  });

  test(`${runtime.name}: hSD15-002/003/006 Arts use their printed damage and Cheer costs`, () => {
    const cases = [
      ['hSD15-002', 0, 20, ['無色']],
      ['hSD15-003', 0, 30, ['綠']],
      ['hSD15-006', 0, 40, ['綠', '無色']],
      ['hSD15-006', 1, 60, ['綠', '無色', '無色']],
    ];
    for (const [number, artIndex, damage, cost] of cases) {
      assert.deepEqual([card(number).arts[artIndex].damage, card(number).arts[artIndex].cost], [damage, cost]);
      let battle = state(number, 'hSD15-006');
      battle.phase = 'performance';
      fund(battle.players[0].zones.center, cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex });
      assert.equal(battle.players[1].zones.center.damage, damage, `${number} Arts ${artIndex + 1}`);
    }
  });

  test(`${runtime.name}: hSD15-004 second-player first-turn Collab attaches Cheer Deck top only to own Back`, () => {
    const fixture = (firstPlayer, turnsTaken) => {
      const battle = main();
      battle.firstPlayer = firstPlayer;
      battle.turn = firstPlayer === 0 && turnsTaken === 1 ? 1 : turnsTaken === 1 ? 2 : 4;
      battle.players[0].turnsTaken = turnsTaken;
      battle.players[1].turnsTaken = firstPlayer === 1 && turnsTaken === 1 ? 1 : 2;
      battle.players[0].zones.back1 = unit('hSD15-004');
      battle.players[0].zones.back2 = unit('hSD15-002');
      battle.players[0].cheerDeck = [inst('hY01-001', `collab-cheer-${firstPlayer}-${turnsTaken}`), inst('hY02-001', `collab-tail-${firstPlayer}-${turnsTaken}`)];
      return battle;
    };

    let eligible = fixture(1, 1);
    eligible = act(eligible, { type: 'collab', zone: 'back1' });
    assert.equal(eligible.pendingChoice?.type, 'eventCheerTarget');
    assert.equal(eligible.pendingChoice.optional, false);
    assert.deepEqual(eligible.pendingChoice.options, ['back2']);
    eligible = choose(eligible, { zone: 'back2' });
    assert.equal(eligible.players[0].zones.back2.cheer[0].id, 'collab-cheer-1-1');
    assert.equal(eligible.players[0].cheerDeck[0].id, 'collab-tail-1-1');

    for (const [firstPlayer, turnsTaken] of [[0, 1], [1, 2]]) {
      const gated = fixture(firstPlayer, turnsTaken);
      const result = act(gated, { type: 'collab', zone: 'back1' });
      assert.equal(result.pendingChoice, null, `firstPlayer=${firstPlayer}, turnsTaken=${turnsTaken}`);
      assert.equal(result.players[0].cheerDeck.length, 2);
    }
  });

  test(`${runtime.name}: hSD15-005 opponent-turn knockout Gift may move one attached Cheer to a different own Holomen`, () => {
    let battle = state('AUDIT-DUMMY', 'hSD15-003');
    battle.phase = 'performance';
    battle.activePlayer = 1;
    battle.players[0].zones.center = unit('hSD15-005', { damage: card('hSD15-005').hp - 100, cheer: [inst('hY01-001', 'down-cheer-1'), inst('hY02-001', 'down-cheer-2')] });
    battle.players[0].zones.back1 = unit('hSD15-002');
    battle.players[1].zones.center = unit(dummy.number);

    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, 1);
    assert.equal(battle.players[0].zones.center?.downPending, true);
    assert.equal(battle.pendingChoice?.effect, 'koTransferCheer');
    assert.equal(battle.pendingChoice.optional, true);
    assert.equal(battle.pendingChoice.max, 1);
    battle = choose(battle, { cardIds: ['down-cheer-1'] }, 0);
    assert.equal(battle.pendingChoice?.effect, 'attachArchiveCheer');
    assert.ok(!battle.pendingChoice.options.includes('center'), 'the defeated Holomen cannot receive its own Gift Cheer');
    battle = choose(battle, { zone: 'back1' }, 0);
    assert.deepEqual(battle.players[0].zones.back1.cheer.map(item => item.id), ['down-cheer-1']);
    assert.equal(battle.players[0].zones.center, null, 'the defeated source leaves Center after the selected Cheer is transferred');
  });
}
