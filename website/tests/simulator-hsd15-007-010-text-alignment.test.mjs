import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, fund } from './fixtures/simulator-audit.mjs';

const blueDummy = { ...dummy, number: 'AUDIT-BLUE', name: 'Blue audit dummy', jpName: 'Blue audit dummy', colors: ['藍'], arts: [] };
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
  const pool = [...cards, dummy, blueDummy, oshi];
  const card = number => cards.find(candidate => candidate.number === number);
  const act = (battle, action, playerIndex = 0) => applyAction(battle, playerIndex, action, pool, () => 0);
  const choose = (battle, action, playerIndex = 0) => act(battle, { type: 'choose', ...action }, playerIndex);
  const main = () => { const battle = state('hSD15-002', 'hSD15-003'); battle.phase = 'main'; return battle; };

  test(`${runtime.name}: hSD15-007 Collab archives its deck top then may stage one Archive Debut`, () => {
    let battle = main();
    battle.players[0].zones.back1 = unit('hSD15-007');
    battle.players[0].mainDeck = [inst('hSD15-002', 'collab-power'), inst('hSD15-003', 'collab-archive-top'), inst('hSD15-006', 'collab-tail')];
    battle.players[0].archive = [inst('hSD15-002', 'archive-raden-debut'), inst('hSD15-006', 'archive-raden-2nd')];

    battle = act(battle, { type: 'collab', zone: 'back1' });
    assert.equal(battle.players[0].holoPower[0].id, 'collab-power', 'ordinary Collab moves the first deck card to Holo Power');
    assert.ok(battle.players[0].archive.some(item => item.id === 'collab-archive-top'), 'the keyword archives the next main-deck top card');
    assert.equal(battle.pendingChoice?.effect, 'archiveCardsToStage');
    assert.equal(battle.pendingChoice.optional, true, 'the printed stage-from-Archive step is optional');
    assert.equal(battle.pendingChoice.cards.some(item => item.id === 'archive-raden-debut'), true);
    assert.equal(battle.pendingChoice.cards.some(item => item.id === 'archive-raden-2nd'), false, 'only Debut Holomen are eligible');
    battle = choose(battle, { cardIds: ['archive-raden-debut'] });
    assert.equal(battle.pendingChoice?.type, 'stageTarget');
    battle = choose(battle, { zone: 'back2' });
    assert.equal(battle.players[0].zones.back2.stack[0].id, 'archive-raden-debut');
    assert.equal(battle.players[0].archive.some(item => item.id === 'archive-raden-debut'), false);
  });

  test(`${runtime.name}: hSD15-007 basic Arts is 30 for one Colorless Cheer`, () => {
    assert.deepEqual([card('hSD15-007').arts[0].damage, card('hSD15-007').arts[0].cost], [30, ['無色']]);
    let battle = state('hSD15-007', 'hSD15-009');
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, card('hSD15-007').arts[0].cost);
    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(battle.players[1].zones.center.damage, 30);
  });

  test(`${runtime.name}: hSD15-008 Arts gains +10 after using a #きのこ Event and its Gift heals on its knockout`, () => {
    let battle = main();
    battle.players[0].zones.center = unit('hSD15-008', { damage: 40 });
    battle.players[0].zones.back1 = unit('hSD15-003');
    battle.players[1].zones.collab = unit(dummy.number, { damage: dummy.hp - 50 });
    battle.players[0].hand = [inst('hSD15-010', 'kinoko-event')];
    battle = act(battle, { type: 'play', cardId: 'kinoko-event' });
    assert.equal(battle.pendingChoice?.effect, 'matsutakeTarget');
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.players[0].zones.back1.modifiers.at(-1).amount, 10);
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, card('hSD15-008').arts[0].cost);
    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'collab', artIndex: 0 });
    assert.equal(battle.players[1].zones.collab, null, 'the Arts knocks out and removes the opposing Collab Holomen');
    assert.equal(battle.players[0].zones.center.damage, 20, 'its Gift heals 20 after it causes that knockout');

    let control = state('hSD15-008', 'hSD15-003');
    control.phase = 'performance';
    control.players[0].zones.center = unit('hSD15-008', { damage: 40 });
    control.players[1].zones.collab = unit(dummy.number);
    fund(control.players[0].zones.center, card('hSD15-008').arts[0].cost);
    control = act(control, { type: 'attack', sourceZone: 'center', targetZone: 'collab', artIndex: 0 });
    assert.equal(control.players[0].zones.center.damage, 40, 'the Gift does not heal when no opposing Holomen is knocked out');
  });

  test(`${runtime.name}: hSD15-008 #きのこ Arts bonus is absent before the Event has been used`, () => {
    let battle = state('hSD15-008', 'hSD15-009');
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, card('hSD15-008').arts[0].cost);
    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(battle.players[1].zones.center.damage, 40, 'the unmodified Arts remains at its printed value');
  });

  test(`${runtime.name}: hSD15-009 Bloom gives +20 only when it enters Center`, () => {
    const bloom = zone => {
      let battle = main();
      battle.players[0].zones.center = unit('hSD15-007');
      battle.players[0].zones.back1 = unit('hSD15-007', { stack: [inst('hSD15-007', `bloom-base-${zone}`)] });
      battle.players[0].hand = [inst('hSD15-009', `bloom-raden-${zone}`)];
      battle = act(battle, { type: 'play', cardId: `bloom-raden-${zone}` });
      assert.equal(battle.pendingChoice?.type, 'bloom');
      battle = choose(battle, { zone });
      return battle;
    };
    const centerBloom = bloom('center');
    assert.equal(centerBloom.players[0].zones.center.modifiers.at(-1)?.sourceNumber, 'hSD15-009');
    assert.equal(centerBloom.players[0].zones.center.modifiers.at(-1)?.amount, 20);
    const backBloom = bloom('back1');
    assert.equal(backBloom.players[0].zones.back1.modifiers.length, 0, 'the center-only Bloom ability does not buff a back-row Raden');
  });

  test(`${runtime.name}: hSD15-009 Arts gains +30 only against Blue Holomen`, () => {
    assert.deepEqual([card('hSD15-009').arts[0].damage, card('hSD15-009').arts[0].cost, card('hSD15-009').arts[0].specialTargets, card('hSD15-009').arts[0].specialValues], [90, ['綠', '無色', '無色'], ['藍'], [30]]);
    for (const [targetNumber, expected] of [['AUDIT-BLUE', 120], ['hSD15-009', 90]]) {
      let battle = state('hSD15-009', targetNumber);
      battle.phase = 'performance';
      fund(battle.players[0].zones.center, card('hSD15-009').arts[0].cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
      assert.equal(battle.players[1].zones.center.damage, expected, `${targetNumber} target`);
    }
  });

  test(`${runtime.name}: hSD15-010 buffs only Raden, with +20 at three Cheer and +10 below three`, () => {
    const resolve = cheerCount => {
      let battle = main();
      battle.players[0].zones.center = unit('hSD15-002', { cheer: Array.from({ length: cheerCount }, (_, index) => inst('hY02-001', `matsutake-cheer-${cheerCount}-${index}`)) });
      battle.players[0].zones.back1 = unit('hSD15-003');
      battle.players[0].zones.back2 = unit('hSD14-002');
      battle.players[0].hand = [inst('hSD15-010', `matsutake-${cheerCount}`)];
      battle = act(battle, { type: 'play', cardId: `matsutake-${cheerCount}` });
      assert.deepEqual(battle.pendingChoice?.options, ['center', 'back1'], 'only own Raden can be selected');
      battle = choose(battle, { zone: 'center' });
      return battle.players[0].zones.center.modifiers.at(-1)?.amount;
    };
    assert.equal(resolve(2), 10);
    assert.equal(resolve(3), 20);
  });
}
