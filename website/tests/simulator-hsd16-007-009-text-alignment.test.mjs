import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction, isActionCandidateLegal as websiteIsActionCandidateLegal } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, fund } from './fixtures/simulator-audit.mjs';

const yellowDummy = { ...dummy, number: 'AUDIT-YELLOW', name: 'Yellow audit dummy', jpName: 'Yellow audit dummy', colors: ['黃'], arts: [] };
const redDummy = { ...dummy, number: 'AUDIT-RED', name: 'Red audit dummy', jpName: 'Red audit dummy', colors: ['紅'], arts: [] };
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
  const pool = [...cards, dummy, yellowDummy, redDummy, oshi];
  const card = number => cards.find(candidate => candidate.number === number);
  const act = (battle, action, playerIndex = 0, random = () => 0) => applyAction(battle, playerIndex, action, pool, random);
  const choose = (battle, action, playerIndex = 0, random = () => 0) => act(battle, { type: 'choose', ...action }, playerIndex, random);
  const main = () => { const battle = state('hSD16-007', 'hSD16-008'); battle.phase = 'main'; return battle; };

  test(`${runtime.name}: hSD16-007 rolls for +10 only from Center; the Arts stays 30 elsewhere`, () => {
    const resolve = (zone, random) => {
      let battle = state('hSD16-007', 'hSD16-002');
      battle.phase = 'performance';
      battle.players[0].zones[zone] = unit('hSD16-007');
      fund(battle.players[0].zones[zone], card('hSD16-007').arts[0].cost);
      battle = act(battle, { type: 'attack', sourceZone: zone, targetZone: 'center', artIndex: 0 }, 0, random);
      return battle;
    };
    const centerHit = resolve('center', () => 0.4);
    assert.equal(centerHit.players[1].zones.center.damage, 40, 'a Center roll of 3 adds ten to the printed 30');
    assert.equal(centerHit.players[0].turnEvents.dice[0].value, 3);
    const centerMiss = resolve('center', () => 0);
    assert.equal(centerMiss.players[1].zones.center.damage, 30, 'a Center roll other than 3 or 5 adds no damage');
    assert.equal(centerMiss.players[0].turnEvents.dice[0].value, 1);
    const collab = state('hSD16-007', 'hSD16-002');
    collab.phase = 'performance';
    collab.players[0].zones.collab = unit('hSD16-007');
    fund(collab.players[0].zones.collab, card('hSD16-007').arts[0].cost);
    assert.equal(isActionCandidateLegal(collab, 0, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 }, pool), false, 'Center-only Arts cannot be declared from Collab');
  });

  test(`${runtime.name}: hSD16-007 Gift draws one card when it is knocked out on the opponent's turn`, () => {
    let battle = state('hSD16-007', dummy.number);
    battle.activePlayer = 1;
    battle.phase = 'performance';
    battle.players[0].zones.center = unit('hSD16-007', { damage: 50 });
    battle.players[0].mainDeck = [inst('hSD16-003', 'miko-gift-draw'), inst('hSD16-004', 'miko-gift-tail')];
    battle.players[1].zones.center = unit(dummy.number);
    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, 1);
    assert.equal(battle.players[0].hand[0]?.id, 'miko-gift-draw');
    assert.equal(battle.players[0].mainDeck.length, 1);
  });

  test(`${runtime.name}: hSD16-008 Collab roll of 3/5 returns one Archive 35P; other rolls do not`, () => {
    const resolve = random => {
      let battle = main();
      battle.players[0].zones.back1 = unit('hSD16-008');
      battle.players[0].mainDeck = [inst(dummy.number, `collab-power-${random}`), inst('hSD16-002', `collab-deck-tail-${random}`)];
      battle.players[0].archive = [inst('hBP03-107', `archive-fan-${random}`), inst('hSD16-003', `archive-tail-${random}`)];
      battle = act(battle, { type: 'collab', zone: 'back1' }, 0, () => random);
      assert.equal(battle.players[0].holoPower[0]?.id, `collab-power-${random}`);
      assert.equal(battle.players[0].turnEvents.dice[0].value, random === 0 ? 1 : 3);
      return battle;
    };
    let hit = resolve(0.4);
    assert.equal(hit.pendingChoice?.effect, 'archiveToHand');
    assert.equal(hit.pendingChoice.cards[0].id, 'archive-fan-0.4');
    hit = choose(hit, { cardIds: ['archive-fan-0.4'] });
    assert.deepEqual(hit.players[0].hand.map(item => item.id), ['archive-fan-0.4']);
    const miss = resolve(0);
    assert.equal(miss.pendingChoice, null, 'a roll of 1 does not create an Archive choice');
    assert.equal(miss.players[0].hand.length, 0);
  });

  test(`${runtime.name}: hSD16-009 Bloom adds ten Arts per own-stage 35P`, () => {
    let battle = main();
    battle.players[0].zones.center = unit('hSD16-006', { attachments: [inst('hBP03-107', 'bloom-center-fan')] });
    battle.players[0].zones.back1 = unit('hSD16-002', { attachments: [inst('hBP03-107', 'bloom-back-fan')] });
    battle.players[0].hand = [inst('hSD16-009', 'miko-second-bloom')];
    battle = act(battle, { type: 'play', cardId: 'miko-second-bloom' });
    assert.equal(battle.pendingChoice?.type, 'bloom');
    battle = choose(battle, { zone: 'center' });
    assert.equal(battle.players[0].zones.center.modifiers.at(-1)?.amount, 20, 'two 35P on the full own stage give this Bloom +20 Arts');
    assert.equal(battle.players[0].zones.center.modifiers.at(-1)?.sourceNumber, 'hSD16-009');
  });

  test(`${runtime.name}: hSD16-009 printed Arts gets +30 only against Yellow`, () => {
    assert.deepEqual([card('hSD16-009').arts[0].damage, card('hSD16-009').arts[0].cost, card('hSD16-009').arts[0].specialTargets, card('hSD16-009').arts[0].specialValues], [100, ['紅', '無色', '無色'], ['黃'], [30]]);
    for (const [targetNumber, expected] of [[yellowDummy.number, 130], [redDummy.number, 100]]) {
      let battle = state('hSD16-009', targetNumber);
      battle.phase = 'performance';
      fund(battle.players[0].zones.center, card('hSD16-009').arts[0].cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
      assert.equal(battle.players[1].zones.center.damage, expected, `${targetNumber} target`);
    }
  });

  test(`${runtime.name}: hSD16-007/008/009 Arts retain their printed damage and costs`, () => {
    for (const [number, damage, cost] of [
      ['hSD16-007', 30, ['無色']],
      ['hSD16-008', 30, ['無色']],
      ['hSD16-009', 100, ['紅', '無色', '無色']],
    ]) {
      assert.deepEqual([card(number).arts[0].damage, card(number).arts[0].cost], [damage, cost], `${number} catalog Arts`);
    }
  });
}
