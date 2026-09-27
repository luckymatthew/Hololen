import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, fund } from './fixtures/simulator-audit.mjs';

const greenDummy = { ...dummy, number: 'AUDIT-GREEN', name: 'Green audit dummy', colors: ['綠'], arts: [] };
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
  const pool = [...cards, dummy, greenDummy, oshi];
  const card = number => cards.find(candidate => candidate.number === number);
  const act = (battle, action, playerIndex = 0, random = () => 0) => applyAction(battle, playerIndex, action, pool, random);
  const choose = (battle, action, playerIndex = 0, random = () => 0) => act(battle, { type: 'choose', ...action }, playerIndex, random);
  const main = () => { const battle = state('hSD18-002', 'hSD18-003'); battle.phase = 'main'; return battle; };

  test(`${runtime.name}: hSD18-007 Arts gains exactly +10 only with an equipped Tool`, () => {
    const resolve = withTool => {
      let battle = state('hSD18-007', 'hSD18-002');
      battle.phase = 'performance';
      battle.players[1].zones.center = unit(dummy.number);
      if (withTool) battle.players[0].zones.center.attachments = [inst('hBP03-095', 'calli-tool')];
      fund(battle.players[0].zones.center, card('hSD18-007').arts[0].cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
      return battle.players[1].zones.center.damage;
    };
    assert.deepEqual([card('hSD18-007').arts[0].damage, card('hSD18-007').arts[0].cost], [30, ['無色']]);
    assert.equal(card('hBP03-095').typeCode, 'supportTool');
    assert.equal(resolve(false), 30, 'without a Tool only the printed 30 damage applies');
    assert.equal(resolve(true), 40, 'with a Tool the conditional +10 applies once');
  });

  test(`${runtime.name}: hSD18-007 Gift archives one deck-top card when knocked out on the opponent turn`, () => {
    let battle = state(dummy.number, 'hSD18-002');
    battle.activePlayer = 1;
    battle.phase = 'performance';
    const hp = card('hSD18-007').hp;
    battle.players[0].zones.center = unit('hSD18-007', { damage: hp - 100 });
    battle.players[1].zones.center = unit(dummy.number);
    battle.players[0].mainDeck = [inst('hSD18-003', 'calli-gift-top'), inst('hSD18-004', 'calli-gift-tail')];
    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, 1);
    assert.equal(battle.players[0].zones.center, null, 'the opponent attack knocks out the Gift Holomen');
    assert.deepEqual(battle.players[0].archive.map(item => item.id), ['calli-gift-top', 'hSD18-007']);
    assert.deepEqual(battle.players[0].mainDeck.map(item => item.id), ['calli-gift-tail']);
  });

  test(`${runtime.name}: hSD18-008 Bloom archives exactly the Main Deck top`, () => {
    let battle = main();
    battle.players[0].zones.center = unit('hSD18-002');
    battle.players[0].hand = [inst('hSD18-008', 'calli-bloom-008')];
    battle.players[0].mainDeck = [inst('hSD18-003', 'calli-bloom-top'), inst('hSD18-004', 'calli-bloom-tail')];
    battle = act(battle, { type: 'play', cardId: 'calli-bloom-008' });
    assert.equal(battle.pendingChoice?.type, 'bloom');
    battle = choose(battle, { zone: 'center' });
    assert.deepEqual(battle.players[0].archive.map(item => item.id), ['calli-bloom-top']);
    assert.deepEqual(battle.players[0].mainDeck.map(item => item.id), ['calli-bloom-tail']);
  });

  test(`${runtime.name}: hSD18-008 only returns an archived Tool from Center Arts`, () => {
    const resolve = sourceZone => {
      let battle = state('hSD18-008', 'hSD18-002');
      if (sourceZone === 'collab') {
        battle.phase = 'main';
        battle.players[0].zones.back1 = unit('hSD18-008');
        battle = act(battle, { type: 'collab', zone: 'back1' });
      } else {
        battle.phase = 'performance';
        battle.players[0].zones.center = unit('hSD18-008');
      }
      battle.phase = 'performance';
      battle.players[1].zones.center = unit(dummy.number);
      battle.players[0].archive = [inst('hBP01-114', `archive-tool-${sourceZone}`), inst('hSD18-002', `archive-unit-${sourceZone}`)];
      fund(battle.players[0].zones[sourceZone], card('hSD18-008').arts[0].cost);
      if (sourceZone === 'center') battle = act(battle, { type: 'attack', sourceZone, targetZone: 'center', artIndex: 0 });
      return battle;
    };
    assert.deepEqual([card('hSD18-008').arts[0].damage, card('hSD18-008').arts[0].cost], [40, ['紫', '無色']]);
    const center = resolve('center');
    assert.equal(center.pendingChoice?.effect, 'archiveToHand');
    assert.deepEqual(center.pendingChoice.cards.map(item => item.id), ['archive-tool-center']);
    const chosen = choose(center, { cardIds: ['archive-tool-center'] });
    assert.equal(chosen.players[0].hand.some(item => item.id === 'archive-tool-center'), true);
    assert.equal(chosen.players[1].zones.center.damage, 40);

    const collab = resolve('collab');
    assert.throws(() => act(collab, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 }), /這個 Arts 不能從目前位置使用/u,
      'the Center-only Arts is unavailable from Collab');
    assert.equal(collab.pendingChoice, null);
    assert.equal(collab.players[0].archive.some(item => item.id === 'archive-tool-collab'), true);
  });

  test(`${runtime.name}: hSD18-009 Collab deals 20 special damage only at six archived Holomen`, () => {
    const resolve = archiveCount => {
      let battle = main();
      battle.players[0].zones.back1 = unit('hSD18-009');
      battle.players[1].zones.center = unit(dummy.number);
      battle.players[0].archive = Array.from({ length: archiveCount }, (_, index) => inst('hSD18-006', `archive-holomem-${archiveCount}-${index}`));
      battle.players[0].mainDeck = [inst('hSD18-002', `collab-power-${archiveCount}`), inst('hSD18-003', `collab-tail-${archiveCount}`)];
      battle = act(battle, { type: 'collab', zone: 'back1' });
      return battle;
    };
    assert.equal(resolve(5).players[1].zones.center.damage, 0, 'five archived Holomen do not meet the condition');
    const met = resolve(6);
    assert.equal(met.players[1].zones.center.damage, 20, 'six archived Holomen trigger fixed special damage to opponent Center');
  });

  test(`${runtime.name}: hSD18-009 Arts gains +30 only against Green`, () => {
    const resolve = targetNumber => {
      let battle = state('hSD18-009', targetNumber);
      battle.phase = 'performance';
      fund(battle.players[0].zones.center, card('hSD18-009').arts[0].cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
      return battle.players[1].zones.center.damage;
    };
    assert.deepEqual([card('hSD18-009').arts[0].damage, card('hSD18-009').arts[0].cost, card('hSD18-009').arts[0].specialTargets, card('hSD18-009').arts[0].specialValues], [90, ['紫', '紫'], ['綠'], [30]]);
    assert.equal(resolve(greenDummy.number), 120);
    assert.equal(resolve(dummy.number), 90, 'a non-Green target receives no color bonus');
  });
}
