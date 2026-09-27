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
  const choose = (battle, playerIndex, action) => act(battle, { type: 'choose', ...action }, playerIndex);
  const main = () => { const battle = state(); battle.phase = 'main'; return battle; };

  test(`${runtime.name}: hSD13-001 normal Oshi may redirect opposing Arts damage to own Red 2nd/Buzz`, () => {
    const makeBattle = targetNumber => {
      let battle = state('hBP01-016', 'hSD13-003');
      battle.phase = 'performance';
      battle.activePlayer = 0;
      battle.players[1].oshi = inst('hSD13-001', 'elizabeth-oshi');
      battle.players[1].zones.back1 = unit(targetNumber, { stack: [inst(targetNumber, 'red-redirect-target')] });
      battle.players[1].holoPower = Array.from({ length: 3 }, (_, index) => inst(dummy.number, `power-${index}`));
      fund(battle.players[0].zones.center, card('hBP01-016').arts[0].cost);
      return act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    };

    let battle = makeBattle('hSD13-007');
    assert.equal(battle.pendingChoice?.effect, 'oshiDamageReaction');
    assert.deepEqual(battle.pendingChoice.modeOptions.map(option => option.id), ['erb:back1']);
    battle = choose(battle, 1, { optionId: 'erb:back1' });
    assert.equal(battle.players[1].zones.center.damage, 0);
    assert.equal(battle.players[1].zones.back1.damage, 10);
    assert.equal(battle.players[1].holoPower.length, 0, 'the printed three Holo Power cost is paid');
    assert.equal(battle.players[1].oshiSkillTurn, battle.turn, 'the normal skill is once per turn');

    const debutOnly = makeBattle('hSD13-003');
    assert.notEqual(debutOnly.pendingChoice?.effect, 'oshiDamageReaction', 'a Red Debut is not an eligible redirect target');
    assert.equal(debutOnly.players[1].zones.center.damage, 10);
  });

  test(`${runtime.name}: hSD13-001 SP places one Archive #Justice Holomen, then attaches one to five Archive Cheer to it`, () => {
    let battle = main();
    battle.players[0].oshi = inst('hSD13-001', 'elizabeth-oshi-sp');
    battle.players[0].holoPower = Array.from({ length: 3 }, (_, index) => inst(dummy.number, `justice-power-${index}`));
    battle.players[0].archive = [inst('hSD13-003', 'justice-debut'), ...Array.from({ length: 5 }, (_, index) => inst('hY01-001', `justice-cheer-${index}`))];

    battle = act(battle, { type: 'spOshiSkill' });
    assert.equal(battle.pendingChoice?.effect, 'archiveCardsToStage');
    assert.equal(battle.pendingChoice.optional, false);
    assert.deepEqual(battle.pendingChoice.selectableIds, ['justice-debut']);
    battle = choose(battle, 0, { cardIds: ['justice-debut'] });
    assert.deepEqual(battle.pendingChoice.options, ['back1', 'back2', 'back3', 'back4', 'back5']);
    battle = choose(battle, 0, { zone: 'back1' });
    assert.equal(battle.pendingChoice?.effect, 'archiveCheerToStage');
    assert.equal(battle.pendingChoice.min, 1);
    assert.equal(battle.pendingChoice.max, 5);
    assert.equal(battle.pendingChoice.meta.targetZone, 'back1', 'all selected Cheer must go to the newly placed Holomen');
    const selectedCheers = ['justice-cheer-0', 'justice-cheer-1', 'justice-cheer-2'];
    battle = choose(battle, 0, { cardIds: selectedCheers });
    for (let index = 0; index < selectedCheers.length; index += 1) {
      assert.equal(battle.pendingChoice?.effect, 'attachArchiveCheer');
      assert.deepEqual(battle.pendingChoice.options, ['back1']);
      battle = choose(battle, 0, { zone: 'back1' });
    }
    assert.deepEqual(battle.players[0].zones.back1.cheer.map(instance => instance.id), selectedCheers);
    assert.deepEqual(battle.players[0].archive.map(instance => instance.id), ['justice-cheer-3', 'justice-cheer-4', 'justice-power-2', 'justice-power-1', 'justice-power-0']);
    assert.equal(battle.players[0].spOshiSkillUsed, true);
  });

  test(`${runtime.name}: hSD13-002 normal Oshi swaps the opposing Center and Collab units`, () => {
    let battle = main();
    battle.players[0].oshi = inst('hSD13-002', 'gigi-oshi-normal');
    battle.players[0].holoPower = [inst(dummy.number, 'gigi-normal-power')];
    battle.players[1].zones.center = unit('hSD13-003', { stack: [inst('hSD13-003', 'old-center')] });
    battle.players[1].zones.collab = unit('hSD13-008', { stack: [inst('hSD13-008', 'old-collab')] });

    battle = act(battle, { type: 'oshiSkill' });
    assert.equal(battle.players[1].zones.center.stack[0].id, 'old-collab');
    assert.equal(battle.players[1].zones.collab.stack[0].id, 'old-center');
    assert.equal(battle.players[0].holoPower.length, 0, 'the printed one Holo Power cost is paid');
    assert.equal(battle.players[0].oshiSkillTurn, battle.turn);
  });

  test(`${runtime.name}: hSD13-002 SP stages exactly two Gigi 2nds, shuffles, then gives distinct own Holomen one Archive Cheer each`, () => {
    let battle = main();
    battle.players[0].oshi = inst('hSD13-002', 'gigi-oshi-sp');
    battle.players[0].holoPower = Array.from({ length: 3 }, (_, index) => inst(dummy.number, `gigi-sp-power-${index}`));
    battle.players[0].archive = [inst('hY01-001', 'gigi-cheer-1'), inst('hY02-001', 'gigi-cheer-2')];
    battle.players[0].mainDeck = [
      inst('hSD13-013', 'gigi-second-1'),
      inst('hSD13-012', 'gigi-first'),
      inst('hSD13-007', 'elizabeth-second'),
      inst('hSD13-013', 'gigi-second-2'),
      inst(dummy.number, 'deck-tail'),
    ];

    battle = act(battle, { type: 'spOshiSkill' });
    assert.equal(battle.pendingChoice?.effect, 'deckCardsToStage');
    assert.equal(battle.pendingChoice.optional, false);
    assert.equal(battle.pendingChoice.max, 2);
    assert.equal(battle.pendingChoice.nonEmptyMin, 2);
    assert.deepEqual(new Set(battle.pendingChoice.selectableIds), new Set(['gigi-second-1', 'gigi-second-2']));
    battle = choose(battle, 0, { cardIds: ['gigi-second-1', 'gigi-second-2'] });
    assert.equal(battle.pendingChoice?.effect, 'placeCard');
    battle = choose(battle, 0, { zone: 'back1' });
    battle = choose(battle, 0, { zone: 'back2' });
    assert.deepEqual(battle.players[0].zones.back1.stack.map(instance => instance.id), ['gigi-second-1']);
    assert.deepEqual(battle.players[0].zones.back2.stack.map(instance => instance.id), ['gigi-second-2']);
    assert.deepEqual(new Set(battle.players[0].mainDeck.map(instance => instance.id)), new Set(['gigi-first', 'elizabeth-second', 'deck-tail']));
    assert.equal(battle.pendingChoice?.effect, 'archiveCheerToStage');
    assert.equal(battle.pendingChoice.min, 2);
    assert.equal(battle.pendingChoice.max, 2);
    battle = choose(battle, 0, { cardIds: ['gigi-cheer-1', 'gigi-cheer-2'] });
    assert.deepEqual(battle.pendingChoice.options, ['center', 'back1', 'back2']);
    battle = choose(battle, 0, { zone: 'center' });
    assert.deepEqual(battle.pendingChoice.options, ['back1', 'back2'], 'the second selected Cheer cannot go to the first recipient again');
    battle = choose(battle, 0, { zone: 'back1' });
    assert.equal(battle.players[0].zones.center.cheer.length, 1);
    assert.equal(battle.players[0].zones.back1.cheer.length, 1);
    assert.equal(battle.players[0].zones.back2.cheer.length, 0);
    assert.equal(battle.players[0].archive.filter(instance => instance.number.startsWith('hY')).length, 0);
    assert.equal(battle.players[0].spOshiSkillUsed, true);
  });
}
