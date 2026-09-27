import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, fund } from './fixtures/simulator-audit.mjs';

const purpleDummy = { ...dummy, number: 'AUDIT-PURPLE', name: 'Purple audit dummy', jpName: 'Purple audit dummy', colors: ['紫'], arts: [] };
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
  const pool = [...cards, dummy, purpleDummy, oshi];
  const card = number => cards.find(candidate => candidate.number === number);
  const act = (battle, action, playerIndex = 0, random = () => 0) => applyAction(battle, playerIndex, action, pool, random);
  const choose = (battle, action, playerIndex = 0, random = () => 0) => act(battle, { type: 'choose', ...action }, playerIndex, random);
  const main = () => { const battle = state('hSD17-002', 'hSD17-003'); battle.phase = 'main'; return battle; };

  test(`${runtime.name}: hSD17-007 Bloom deals 10 special damage only when it enters a Back`, () => {
    const bloom = zone => {
      let battle = main();
      battle.players[0].zones.center = unit('hSD17-002');
      battle.players[0].zones.back1 = unit('hSD17-003');
      battle.players[0].hand = [inst('hSD17-007', `bloom-susei-${zone}`)];
      battle.players[1].zones.back1 = unit(dummy.number);
      battle = act(battle, { type: 'play', cardId: `bloom-susei-${zone}` });
      assert.equal(battle.pendingChoice?.type, 'bloom');
      battle = choose(battle, { zone });
      return battle;
    };
    const back = bloom('back1');
    assert.equal(back.pendingChoice?.effect, 'specialDamage');
    assert.deepEqual(back.pendingChoice.options, ['back1']);
    assert.equal(back.pendingChoice.meta.amount, 10);
    const resolved = choose(back, { zone: 'back1' });
    assert.equal(resolved.players[1].zones.back1.damage, 10);
    const center = bloom('center');
    assert.equal(center.pendingChoice, null, 'Center Bloom does not trigger the Back-only ability');
  });

  test(`${runtime.name}: hSD17-008 Arts deals 40 plus 10 special damage to a Back, and its Gift draws on opponent-turn knockout`, () => {
    assert.deepEqual([card('hSD17-008').arts[0].damage, card('hSD17-008').arts[0].cost], [40, ['藍', '無色']]);
    let battle = state('hSD17-008', 'hSD17-002');
    battle.phase = 'performance';
    battle.players[1].zones.back1 = unit(dummy.number);
    fund(battle.players[0].zones.center, card('hSD17-008').arts[0].cost);
    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(battle.pendingChoice?.effect, 'specialDamage');
    assert.deepEqual(battle.pendingChoice.options, ['back1']);
    assert.equal(battle.pendingChoice.meta.amount, 10);
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.players[1].zones.center.damage, 40);
    assert.equal(battle.players[1].zones.back1.damage, 10);

    let defeated = state('hSD17-008', dummy.number);
    defeated.activePlayer = 1;
    defeated.phase = 'performance';
    defeated.players[0].zones.center = unit('hSD17-008', { damage: 50 });
    defeated.players[0].mainDeck = [inst('hSD17-003', 'suisei-gift-draw'), inst('hSD17-004', 'suisei-gift-tail')];
    defeated.players[1].zones.center = unit(dummy.number);
    defeated = act(defeated, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, 1);
    assert.equal(defeated.players[0].hand[0]?.id, 'suisei-gift-draw');
    assert.equal(defeated.players[0].mainDeck.length, 1);
  });

  test(`${runtime.name}: hSD17-009 Collab grants +20 Arts this turn; its Arts gets +30 only against Purple`, () => {
    assert.deepEqual([card('hSD17-009').arts[0].damage, card('hSD17-009').arts[0].cost, card('hSD17-009').arts[0].specialTargets, card('hSD17-009').arts[0].specialValues], [110, ['藍', '藍', '無色'], ['紫'], [30]]);
    let battle = main();
    battle.players[0].zones.back1 = unit('hSD17-009');
    battle.players[0].mainDeck = [inst(dummy.number, 'collab-power'), inst('hSD17-002', 'collab-tail')];
    battle.players[1].zones.center = unit(purpleDummy.number);
    battle = act(battle, { type: 'collab', zone: 'back1' });
    assert.equal(battle.players[0].zones.collab.modifiers.at(-1)?.amount, 20);
    battle.phase = 'performance';
    fund(battle.players[0].zones.collab, card('hSD17-009').arts[0].cost);
    battle = act(battle, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 });
    assert.equal(battle.players[1].zones.center.damage, 160, '110 printed +20 Collab modifier +30 against Purple');

    let nonPurple = state('hSD17-009', 'hSD17-002');
    nonPurple.phase = 'performance';
    nonPurple.players[1].zones.center = unit(dummy.number);
    fund(nonPurple.players[0].zones.center, card('hSD17-009').arts[0].cost);
    nonPurple = act(nonPurple, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(nonPurple.players[1].zones.center.damage, 110, 'non-Purple control gets neither target bonus nor Collab buff');
  });

  test(`${runtime.name}: hSD17-010 Stella deals 20 to a non-Debut Back and is once per turn`, () => {
    let battle = main();
    battle.players[1].zones.back1 = unit('hSD17-002');
    battle.players[1].zones.back2 = unit('hSD17-006');
    battle.players[1].zones.back3 = unit('hSD17-009');
    battle.players[0].hand = [inst('hSD17-010', 'stella-event-1'), inst('hSD17-010', 'stella-event-2')];

    battle = act(battle, { type: 'play', cardId: 'stella-event-1' });
    assert.equal(battle.pendingChoice?.effect, 'specialDamage');
    assert.deepEqual(battle.pendingChoice.options, ['back2', 'back3'], 'Debut is excluded; 1st and 2nd Back targets remain eligible');
    assert.equal(battle.pendingChoice.meta.amount, 20);
    battle = choose(battle, { zone: 'back3' });
    assert.equal(battle.players[1].zones.back3.damage, 20);
    assert.equal(battle.players[1].zones.back1.damage, 0);
    assert.throws(() => act(battle, { type: 'play', cardId: 'stella-event-2' }), /本回合已使用過 Stella/u);
    assert.equal(battle.players[0].hand.some(item => item.id === 'stella-event-2'), true, 'rejected duplicate stays in hand');
  });
}
