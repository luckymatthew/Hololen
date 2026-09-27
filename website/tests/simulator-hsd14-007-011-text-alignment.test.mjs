import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction, isActionCandidateLegal as websiteIsActionCandidateLegal } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, fund } from './fixtures/simulator-audit.mjs';

const redDummy = { ...dummy, number: 'AUDIT-RED', name: 'Red audit dummy', jpName: 'Red audit dummy', colors: ['紅'], arts: [] };
const eightyDamageDummy = { ...dummy, number: 'AUDIT-80', name: '80 damage audit dummy', hp: 10000, colors: [], arts: [{ name: '80 damage', damage: 80, cost: [], effect: '' }] };
const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, isActionCandidateLegal: websiteIsActionCandidateLegal, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const catalog = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, isActionCandidateLegal: engine.isActionCandidateLegal, cards: catalog });
}

for (const runtime of runtimes) {
  const { applyAction, isActionCandidateLegal, cards } = runtime;
  const pool = [...cards, dummy, redDummy, eightyDamageDummy, oshi];
  const card = number => cards.find(candidate => candidate.number === number);
  const act = (battle, action, playerIndex = 0) => applyAction(battle, playerIndex, action, pool, () => 0);
  const choose = (battle, action, playerIndex = 0) => act(battle, { type: 'choose', ...action }, playerIndex);
  const main = () => { const battle = state('hSD14-002', 'hSD14-003'); battle.phase = 'main'; return battle; };

  test(`${runtime.name}: hSD14-007 Bloom buffs only own Center by +10 Arts this turn`, () => {
    let battle = main();
    battle.players[0].zones.center = unit('hSD14-002');
    battle.players[0].zones.back1 = unit('hSD14-004');
    battle.players[0].hand = [inst('hSD14-007', 'bloom-fubuki')];
    battle = act(battle, { type: 'play', cardId: 'bloom-fubuki' });
    assert.equal(battle.pendingChoice?.type, 'bloom');
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.players[0].zones.center.modifiers.at(-1)?.sourceNumber, 'hSD14-007');
    assert.equal(battle.players[0].zones.center.modifiers.at(-1)?.amount, 10);
    assert.equal(battle.players[0].zones.back1.modifiers.length, 0, 'Bloom target is the own Center, not the new Bloom unit');
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, card('hSD14-002').arts[0].cost);
    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(battle.players[1].zones.center.damage, 30, 'printed 20 plus the temporary +10');
  });

  test(`${runtime.name}: hSD14-008 Collab attaches one Archive mascot to itself and its Collab Arts gains +20`, () => {
    let battle = main();
    battle.players[0].zones.back1 = unit('hSD14-008');
    battle.players[0].archive = [inst('hSD14-011', 'archive-mascot')];
    battle = act(battle, { type: 'collab', zone: 'back1' });
    assert.equal(battle.pendingChoice?.effect, 'genericArchiveSupportPick');
    assert.equal(battle.pendingChoice.min, 1);
    battle = choose(battle, { cardIds: ['archive-mascot'] });
    assert.equal(battle.pendingChoice?.type, 'attachArchivedSupport');
    assert.deepEqual(battle.pendingChoice.options, ['collab']);
    battle = choose(battle, { zone: 'collab' });
    assert.deepEqual(battle.players[0].zones.collab.attachments.map(item => item.id), ['archive-mascot']);
    battle.phase = 'performance';
    fund(battle.players[0].zones.collab, card('hSD14-008').arts[0].cost);
    battle = act(battle, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 });
    assert.equal(battle.players[1].zones.center.damage, 40, 'printed 20 plus mascot-only Collab bonus 20');

    let noMascot = main();
    noMascot.players[0].zones.collab = unit('hSD14-008');
    noMascot.phase = 'performance';
    fund(noMascot.players[0].zones.collab, card('hSD14-008').arts[0].cost);
    noMascot = act(noMascot, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 });
    assert.equal(noMascot.players[1].zones.center.damage, 20, 'the Collab bonus is absent without a mascot');
  });

  test(`${runtime.name}: hSD14-009 Arts deals 90 plus 30 only to Red Holomen`, () => {
    assert.deepEqual([card('hSD14-009').arts[0].damage, card('hSD14-009').arts[0].cost, card('hSD14-009').arts[0].specialTargets, card('hSD14-009').arts[0].specialValues], [90, ['白', '無色'], ['紅'], [30]]);
    for (const [targetNumber, expected] of [['AUDIT-RED', 120], ['hSD14-009', 90]]) {
      let battle = state('hSD14-009', targetNumber);
      battle.phase = 'performance';
      fund(battle.players[0].zones.center, card('hSD14-009').arts[0].cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
      assert.equal(battle.players[1].zones.center.damage, expected, `${targetNumber} target color`);
    }
  });

  test(`${runtime.name}: hSD14-009 opponent-turn knockout Gift draws only when a mascot is attached`, () => {
    const knockOut = mascot => {
      let battle = state('AUDIT-DUMMY', 'hSD14-009');
      battle.phase = 'performance';
      battle.players[1].zones.collab = unit('hSD14-009', { damage: 80, attachments: mascot ? [inst('hSD14-011', 'gift-mascot')] : [] });
      battle.players[1].mainDeck = [inst('hSD14-003', `gift-draw-${mascot}`), inst('hSD14-002', `gift-tail-${mascot}`)];
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'collab', artIndex: 0 });
      assert.equal(battle.players[1].zones.collab, null, "the target is knocked out during its owner's opponent turn");
      return battle;
    };
    const withMascot = knockOut(true);
    assert.deepEqual(withMascot.players[1].hand.map(item => item.id), ['gift-draw-true']);
    const withoutMascot = knockOut(false);
    assert.deepEqual(withoutMascot.players[1].hand, []);
  });

  test(`${runtime.name}: hSD14-010 draws the deck top three and consumes one LIMITED use`, () => {
    let battle = main();
    battle.players[0].hand = [inst('hSD14-010', 'holoan-first'), inst('hSD14-010', 'holoan-second')];
    battle.players[0].mainDeck = [inst('hSD14-002', 'draw-1'), inst('hSD14-003', 'draw-2'), inst('hSD14-004', 'draw-3'), inst('hSD14-005', 'deck-tail')];
    assert.equal(isActionCandidateLegal(battle, 0, { type: 'play', cardId: 'holoan-first' }, pool), true);
    battle = act(battle, { type: 'play', cardId: 'holoan-first' });
    assert.deepEqual(battle.players[0].hand.map(item => item.id), ['holoan-second', 'draw-1', 'draw-2', 'draw-3']);
    assert.deepEqual(battle.players[0].mainDeck.map(item => item.id), ['deck-tail']);
    assert.equal(battle.players[0].limitedUsesCount, 1);
    assert.equal(isActionCandidateLegal(battle, 0, { type: 'play', cardId: 'holoan-second' }, pool), false);
    assert.throws(() => act(battle, { type: 'play', cardId: 'holoan-second' }), /LIMITED|最多|每回合/u);
  });

  test(`${runtime.name}: hSD14-011 mascot grants +10 HP and enforces one mascot per Holomen`, () => {
    let battle = state('AUDIT-80', 'hSD14-003');
    battle.phase = 'performance';
    battle.players[1].zones.center = unit('hSD14-002', { attachments: [inst('hSD14-011', 'hp-mascot')] });
    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(battle.players[1].zones.center.damage, 80);
    assert.equal(battle.players[1].zones.center.stack.at(-1).number, 'hSD14-002', 'the 80 damage does not defeat 80 HP Fubuki after mascot HP +10');

    let limit = main();
    limit.players[0].zones.center = unit('hSD14-002', { attachments: [inst('hSD14-011', 'first-mascot')] });
    limit.players[0].hand = [inst('hSD14-011', 'second-mascot')];
    assert.equal(isActionCandidateLegal(limit, 0, { type: 'play', cardId: 'second-mascot' }, pool), false);
    assert.throws(() => act(limit, { type: 'play', cardId: 'second-mascot' }));
    assert.equal(limit.players[0].hand[0].id, 'second-mascot', 'an illegal second mascot is not consumed');
  });

  test(`${runtime.name}: hSD14-011 on Fubuki attaches the Cheer Deck top when that Holomen knocks out an opponent`, () => {
    let battle = state('hSD14-002', 'hSD14-003');
    battle.phase = 'performance';
    battle.players[0].zones.center = unit('hSD14-002', { attachments: [inst('hSD14-011', 'fubuki-mascot')] });
    battle.players[0].zones.back1 = unit('hSD14-003');
    battle.players[0].cheerDeck = [inst('hY01-001', 'trigger-cheer'), inst('hY02-001', 'trigger-cheer-tail')];
    battle.players[1].zones.collab = unit('hSD14-003', { damage: 50 });
    fund(battle.players[0].zones.center, card('hSD14-002').arts[0].cost);

    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'collab', artIndex: 0 });
    assert.equal(battle.players[1].zones.collab?.downPending, true, 'Fubuki has reached the knockout resolution for the opposing Holomen');
    assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
    assert.equal(battle.pendingChoice.playerIndex, 0);
    battle = choose(battle, { zone: 'back1' });
    assert.deepEqual(battle.players[0].zones.back1.cheer.map(item => item.id), ['trigger-cheer']);
    assert.deepEqual(battle.players[0].cheerDeck.map(item => item.id), ['trigger-cheer-tail']);
  });
}
