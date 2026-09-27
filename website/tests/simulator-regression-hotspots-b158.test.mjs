import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction, isActionCandidateLegal as websiteIsActionCandidateLegal } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, fund, attack } from './fixtures/simulator-audit.mjs';

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
  const green = { number: 'AUDIT-GREEN-2ND', name: 'Audit Green', jpName: 'Audit Green', group: 'holomem', typeCode: 'character', stage: '2nd', hp: 10000, colors: ['綠'], tags: [], arts: [] };
  const white = { number: 'AUDIT-WHITE-2ND', name: 'Audit White', jpName: 'Audit White', group: 'holomem', typeCode: 'character', stage: '2nd', hp: 10000, colors: ['白'], tags: [], arts: [] };
  const pool = [...cards, dummy, oshi, green, white];
  const card = number => cards.find(candidate => candidate.number === number);
  const run = (battle, playerIndex, action) => applyAction(battle, playerIndex, action, pool, () => 0);
  const main = (source = 'hSD13-008', target = 'AUDIT-DUMMY') => { const battle = state(source, target); battle.phase = 'main'; return battle; };
  const resolveCollabSearch = (collabNumber, targetId, suffix) => {
    let battle = main();
    battle.players[0].zones.back1 = unit(collabNumber);
    battle.players[0].mainDeck = [inst('AUDIT-DUMMY', `${suffix}-power`), inst(targetId, `${suffix}-target`)];
    battle = run(battle, 0, { type: 'collab', zone: 'back1' });
    return battle;
  };

  test(`${runtime.name}: hBP03-060 counts the opponent's seven Cheer for +70, separately from its green-target +50`, () => {
    const attackFor = (targetNumber, opponentCheer, ownCheer = 0) => {
      let battle = state('hBP03-060', targetNumber);
      battle.players[0].zones.center = unit('hBP03-060');
      battle.players[1].zones.center = unit(targetNumber, { cheer: Array.from({ length: opponentCheer }, (_, i) => inst('hY01-001', `opp-${targetNumber}-${i}`)) });
      fund(battle.players[0].zones.center, card('hBP03-060').arts[0].cost);
      if (ownCheer > 0) battle.players[0].zones.center.cheer.push(...Array.from({ length: ownCheer }, (_, i) => inst('hY01-001', `own-${i}`)));
      return run(battle, 0, attack).players[1].zones.center.damage;
    };

    assert.equal(attackFor(green.number, 7), 190, '70 printed +70 for opponent stage Cheer and +50 for the green target');
    assert.equal(attackFor(white.number, 7), 140, 'the opponent threshold still grants +70 without the green-only bonus');
    assert.equal(attackFor(green.number, 6, 7), 120, 'own Cheer cannot substitute for the opponent threshold');
  });

  test(`${runtime.name}: hBP08-070 Collab effect obligatorily searches and adds Takodachi, then shuffles`, () => {
    let battle = resolveCollabSearch('hBP08-070', 'hBP08-110', 'ina-takodachi');
    assert.equal(battle.pendingChoice?.type, 'cardSelection');
    assert.equal(battle.pendingChoice?.optional, false);
    assert.equal(battle.pendingChoice?.nonEmptyMin, 1);
    assert.deepEqual(battle.pendingChoice.selectableIds, ['ina-takodachi-target']);
    assert.equal(isActionCandidateLegal(battle, 0, { type: 'choose', cardIds: [] }, pool), true, 'the engine preserves its established hidden-deck fail-to-find flow');
    const failedFind = run(battle, 0, { type: 'choose', cardIds: [] });
    assert.equal(failedFind.players[0].hand.length, 0, 'failing to find does not add the available hidden card');
    assert.equal(failedFind.players[0].mainDeck.some(instance => instance.id === 'ina-takodachi-target'), true);

    battle = resolveCollabSearch('hBP08-070', 'hBP08-110', 'ina-takodachi-success');
    battle = run(battle, 0, { type: 'choose', cardIds: ['ina-takodachi-success-target'] });
    assert.equal(battle.players[0].hand.some(instance => instance.id === 'ina-takodachi-success-target'), true);
    assert.equal(battle.players[0].mainDeck.some(instance => instance.id === 'ina-takodachi-success-target'), false);

    const noMatch = resolveCollabSearch('hBP08-070', 'AUDIT-DUMMY', 'ina-no-match');
    assert.equal(noMatch.pendingChoice, null, 'a deck with no Takodachi has no impossible mandatory selection');
  });

  test(`${runtime.name}: hBP08-075 Bloom search does not trigger merely from Collab`, () => {
    const robosa = cards.find(candidate => candidate.jpName === 'ろぼさー');
    assert.ok(robosa);
    const battle = resolveCollabSearch('hBP08-075', robosa.number, 'robosa-collab');
    assert.equal(battle.pendingChoice, null, 'Robosa is searched on Bloom, not on Collab');
  });

  test(`${runtime.name}: hBP08-075 still searches for Robosa when its Bloom effect triggers`, () => {
    const prior = cards.find(candidate => candidate.jpName === 'ロボ子さん' && candidate.stage === '1st');
    const robosa = cards.find(candidate => candidate.jpName === 'ろぼさー');
    assert.ok(prior && robosa);
    let battle = main(prior.number);
    battle.players[0].hand = [inst('hBP08-075', 'robosa-bloom')];
    battle.players[0].mainDeck = [inst('AUDIT-DUMMY', 'robosa-power'), inst(robosa.number, 'robosa-target')];
    battle = run(battle, 0, { type: 'play', cardId: 'robosa-bloom' });
    battle = run(battle, 0, { type: 'choose', zone: 'center' });
    assert.equal(battle.pendingChoice?.type, 'cardSelection');
    assert.equal(battle.pendingChoice?.optional, false);
    assert.equal(battle.pendingChoice?.nonEmptyMin, 1);
    assert.equal(isActionCandidateLegal(battle, 0, { type: 'choose', cardIds: [] }, pool), true, 'hidden Bloom searches preserve fail-to-find behavior');
    assert.deepEqual(battle.pendingChoice.selectableIds, ['robosa-target']);
  });
}
