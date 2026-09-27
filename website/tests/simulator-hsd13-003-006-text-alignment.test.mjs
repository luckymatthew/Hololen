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
  const main = () => { const battle = state(); battle.phase = 'main'; return battle; };
  const perform = sourceNumber => { const battle = state(sourceNumber); battle.phase = 'performance'; return battle; };

  test(`${runtime.name}: hSD13-003 unlimited Debut is accepted above four copies and its Colorless Arts deals 30`, () => {
    const deck = {
      oshi: { 'hSD13-001': 1 },
      main: { 'hSD13-003': 5, 'hSD05-002': 45 },
      cheer: { 'hY01-001': 20 },
    };
    assert.equal(card('hSD13-003').unlimited, true);
    assert.match(card('hSD13-003').extra, /任意張數/u);
    assert.equal(validateBattleDeck(deck, cards).ok, true, 'printed unlimited-copy permission must reach real deck validation');

    let battle = perform('hSD13-003');
    fund(battle.players[0].zones.center, card('hSD13-003').arts[0].cost);
    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(battle.players[1].zones.center.damage, 30);
  });

  test(`${runtime.name}: hSD13-004 both Arts pay and deal their printed damage`, () => {
    const printed = card('hSD13-004').arts;
    assert.deepEqual(printed.map(art => [art.damage, art.cost]), [[40, ['無色']], [140, ['紅', '無色', '無色', '無色']]]);
    for (const [artIndex, expectedDamage] of [[0, 40], [1, 140]]) {
      let battle = perform('hSD13-004');
      fund(battle.players[0].zones.center, printed[artIndex].cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex });
      assert.equal(battle.players[1].zones.center.damage, expectedDamage, `Arts ${artIndex + 1}`);
    }
  });

  test(`${runtime.name}: hSD13-005 Arts deals 50 and its Gift attaches the top Cheer to an ERB once during the opponent turn`, () => {
    const arts = card('hSD13-005').arts[0];
    assert.deepEqual([arts.damage, arts.cost], [50, ['紅', '無色']]);
    let artBattle = perform('hSD13-005');
    fund(artBattle.players[0].zones.center, arts.cost);
    artBattle = act(artBattle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(artBattle.players[1].zones.center.damage, 50);

    let battle = state();
    battle.phase = 'performance';
    battle.activePlayer = 1;
    battle.players[0].zones.center = unit('hSD13-003', { damage: card('hSD13-003').hp - 10 });
    battle.players[0].zones.collab = unit('hSD13-008', { damage: card('hSD13-008').hp - 10 });
    battle.players[0].zones.back1 = unit('hSD13-005', { stack: [inst('hSD13-005', 'gift-source')] });
    battle.players[0].cheerDeck = [inst('hY01-001', 'gift-top'), inst('hY02-001', 'gift-next')];
    battle.players[1].zones.center = unit('hBP01-016');
    battle.players[1].zones.collab = unit('hBP01-016', { stack: [inst('hBP01-016', 'second-attacker')] });
    fund(battle.players[1].zones.center, card('hBP01-016').arts[0].cost);
    fund(battle.players[1].zones.collab, card('hBP01-016').arts[0].cost);

    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, 1);
    assert.equal(battle.pendingChoice?.effect, 'erbGiftCheer');
    assert.deepEqual(battle.pendingChoice.options, ['back1']);
    battle = choose(battle, 0, { zone: 'back1' });
    assert.deepEqual(battle.players[0].zones.back1.cheer.map(instance => instance.id), ['gift-top']);
    assert.deepEqual(battle.players[0].cheerDeck.map(instance => instance.id), ['gift-next']);
    assert.equal(battle.pendingChoice?.type, 'lifeCheerTarget', 'finish the unrelated knockout Life Cheer before the next action');
    battle = choose(battle, 0, { zone: 'collab' });

    battle = act(battle, { type: 'attack', sourceZone: 'collab', targetZone: 'collab', artIndex: 0 }, 1);
    assert.equal(battle.players[0].zones.collab, null, 'a second opposing-turn #Justice knockout still resolves');
    assert.notEqual(battle.pendingChoice?.effect, 'erbGiftCheer', 'For Justice! -ERB- is once per turn');
    assert.deepEqual(battle.players[0].cheerDeck.map(instance => instance.id), ['gift-next']);
  });

  test(`${runtime.name}: hSD13-006 Bloom buffs one selected own #Justice Holomen's Arts by 20 this turn`, () => {
    assert.deepEqual([card('hSD13-006').arts[0].damage, card('hSD13-006').arts[0].cost], [30, ['無色']]);
    let battle = main();
    battle.players[0].turnsTaken = 2;
    battle.players[0].zones.center = unit('hSD13-003');
    battle.players[0].zones.back1 = unit('hSD13-008');
    battle.players[0].zones.back2 = unit('hSD11-007');
    battle.players[0].hand = [inst('hSD13-006', 'bloom-erb')];
    battle.players[1].zones.center = unit(dummy.number, { stack: [inst(dummy.number, 'opponent-center')] });

    battle = act(battle, { type: 'play', cardId: 'bloom-erb' });
    assert.equal(battle.pendingChoice?.type, 'bloom');
    assert.deepEqual(battle.pendingChoice.options, ['center']);
    battle = choose(battle, 0, { zone: 'center' });
    assert.equal(battle.pendingChoice?.effect, 'addModifier');
    assert.deepEqual(battle.pendingChoice.options, ['center', 'back1'], 'the ability selects only own #Justice Holomen');
    battle = choose(battle, 0, { zone: 'center' });
    assert.equal(battle.players[0].zones.center.modifiers.at(-1).amount, 20);
    assert.equal(battle.players[0].zones.back2.modifiers.length, 0, 'a non-Justice Holomen receives no Arts modifier');

    battle.phase = 'performance';
    fund(battle.players[0].zones.center, card('hSD13-003').arts[0].cost);
    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(battle.players[1].zones.center.damage, 50, 'printed 30 plus the chosen +20 modifier');
  });
}
