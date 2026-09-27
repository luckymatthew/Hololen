import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, state, unit, inst, fund, attack } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const cards = JSON.parse(readFileSync(androidCardsUrl, 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, cards });
}
for (const runtime of runtimes) runtime.pool = [...runtime.cards, dummy];

const choose = (runtime, battle, action, random = () => 0) => runtime.applyAction(battle, 0, { type: 'choose', ...action }, runtime.pool, random);

for (const runtime of runtimes) {
  const { applyAction, cards, pool } = runtime;

  test(`${runtime.name}: hSD01-007 Collab moves one selected Holo Power to hand then one hand card to Power`, () => {
    let battle = state('hSD01-003');
    battle.phase = 'main';
    battle.players[0].zones.back1 = unit('hSD01-007');
    battle.players[0].hand = [inst('AUDIT-DUMMY', 'hand-a'), inst('hSD01-003', 'hand-b')];
    battle.players[0].holoPower = [inst('AUDIT-DUMMY', 'power-a'), inst('hSD01-003', 'power-b')];
    battle.players[0].mainDeck = [inst('AUDIT-DUMMY', 'collab-power'), ...battle.players[0].mainDeck.slice(1)];

    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'giftRaoraPowerPick');
    assert.deepEqual(new Set(battle.pendingChoice.cards.map(card => card.id)), new Set(['power-a', 'power-b', 'collab-power']));
    battle = choose(runtime, battle, { cardIds: ['power-b'] });
    assert.equal(battle.pendingChoice?.effect, 'giftHandToPower');
    assert.deepEqual(new Set(battle.pendingChoice.cards.map(card => card.id)), new Set(['hand-a', 'hand-b', 'power-b']));
    battle = choose(runtime, battle, { cardIds: ['hand-a'] });

    assert.equal(battle.pendingChoice, null);
    assert.deepEqual(new Set(battle.players[0].hand.map(card => card.id)), new Set(['hand-b', 'power-b']));
    assert.deepEqual(new Set(battle.players[0].holoPower.map(card => card.id)), new Set(['power-a', 'collab-power', 'hand-a']));
  });

  test(`${runtime.name}: hSD01-007 basic White Arts is 20`, () => {
    const card = cards.find(candidate => candidate.number === 'hSD01-007');
    assert.equal(card.arts[0].damage, 20);
    assert.deepEqual(card.arts[0].cost, ['白']);
    const battle = state('hSD01-007');
    fund(battle.players[0].zones.center, ['白']);
    const result = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(result.players[1].zones.center.damage, 20);
  });

  test(`${runtime.name}: hSD01-008 basic Colorless Arts is 20`, () => {
    const card = cards.find(candidate => candidate.number === 'hSD01-008');
    assert.equal(card.arts[0].damage, 20);
    assert.deepEqual(card.arts[0].cost, ['無色']);
    const battle = state('hSD01-008');
    fund(battle.players[0].zones.center, ['無色']);
    const result = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(result.players[1].zones.center.damage, 20);
  });

  test(`${runtime.name}: hSD01-009 basic Colorless Arts is 10`, () => {
    const card = cards.find(candidate => candidate.number === 'hSD01-009');
    assert.equal(card.arts[0].damage, 10);
    assert.deepEqual(card.arts[0].cost, ['無色']);
    const battle = state('hSD01-009');
    fund(battle.players[0].zones.center, ['無色']);
    const result = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(result.players[1].zones.center.damage, 10);
  });

  for (let die = 1; die <= 6; die += 1) {
    test(`${runtime.name}: hSD01-009 Collab die ${die} follows the printed Cheer and optional-move thresholds`, () => {
      let battle = state('hSD01-003');
      battle.phase = 'main';
      battle.players[0].zones.back1 = unit('hSD01-009');
      battle.players[0].zones.back2 = unit('hSD01-008');
      battle.players[0].cheerDeck = [inst('hY02-001', 'cheer-top'), inst('hY01-001', 'cheer-next')];
      battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
      assert.equal(battle.pendingChoice?.effect, 'azkiMapRoll');
      battle = choose(runtime, battle, { optionId: 'roll' }, () => (die - 0.5) / 6);

      if (die <= 4) {
        assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
        assert.deepEqual(battle.pendingChoice.options, ['back2']);
        battle = choose(runtime, battle, { zone: 'back2' });
        assert.deepEqual(battle.players[0].zones.back2.cheer.map(card => card.id), ['cheer-top']);
        assert.deepEqual(battle.players[0].cheerDeck.map(card => card.id), ['cheer-next']);
      } else {
        assert.equal(battle.pendingChoice, null);
        assert.equal(battle.players[0].zones.back2.cheer.length, 0);
        assert.deepEqual(battle.players[0].cheerDeck.map(card => card.id), ['cheer-top', 'cheer-next']);
      }

      if (die === 1) {
        assert.equal(battle.pendingChoice?.effect, 'azkiMapReturn');
        battle = choose(runtime, battle, { optionId: 'return' });
        assert.equal(battle.players[0].zones.back1?.stack.at(-1).number, 'hSD01-009');
        assert.equal(battle.players[0].zones.collab, null);
      } else {
        assert.equal(battle.players[0].zones.collab.stack.at(-1).number, 'hSD01-009');
      }
    });
  }

  test(`${runtime.name}: hSD01-009 die 1 movement is optional after the Cheer has attached`, () => {
    let battle = state('hSD01-003');
    battle.phase = 'main';
    battle.players[0].zones.back1 = unit('hSD01-009');
    battle.players[0].zones.back2 = unit('hSD01-008');
    battle.players[0].cheerDeck = [inst('hY02-001', 'cheer-top')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    battle = choose(runtime, battle, { optionId: 'roll' }, () => 0.01);
    battle = choose(runtime, battle, { zone: 'back2' });
    assert.equal(battle.pendingChoice?.effect, 'azkiMapReturn');
    battle = choose(runtime, battle, { skip: true });

    assert.equal(battle.players[0].zones.collab.stack.at(-1).number, 'hSD01-009');
    assert.deepEqual(battle.players[0].zones.back2.cheer.map(card => card.id), ['cheer-top']);
  });
}
