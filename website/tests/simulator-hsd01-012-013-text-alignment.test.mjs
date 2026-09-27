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
const dieRandom = die => () => (die - 0.5) / 6;

for (const runtime of runtimes) {
  const { applyAction, cards, pool } = runtime;
  const iofi = cards.find(card => card.number === 'hSD01-012');
  const soraz = cards.find(card => card.number === 'hSD01-013');
  assert.ok(iofi && soraz, 'catalog needs Iofi and SorAZ');

  test(`${runtime.name}: hSD01-012 Green Arts costs one Green Cheer and deals 20`, () => {
    assert.equal(iofi.arts[0].damage, 20);
    assert.deepEqual(iofi.arts[0].cost, ['綠']);
    const battle = state('hSD01-012');
    fund(battle.players[0].zones.center, ['綠']);
    const result = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(result.players[1].zones.center.damage, 20);
  });

  test(`${runtime.name}: hSD01-012 Collab selects only White/Green archived Cheer and attaches it to Center`, () => {
    assert.match(iofi.keyword.effect, /檔案區域中的1張\[白應援或綠應援\].*自己的中央成員/u);
    let battle = state('hSD01-003');
    battle.phase = 'main';
    battle.players[0].zones.back1 = unit('hSD01-012');
    battle.players[0].archive = [inst('hY01-001', 'white-archive'), inst('hY02-001', 'green-archive'), inst('hY03-001', 'red-archive')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'archiveCheerToStage');
    assert.deepEqual(new Set(battle.pendingChoice.cards.map(card => card.id)), new Set(['white-archive', 'green-archive']));
    assert.deepEqual(battle.pendingChoice.meta?.targetRule?.zones, ['center']);
    battle = choose(runtime, battle, { cardIds: ['green-archive'] });
    assert.deepEqual(battle.pendingChoice?.options, ['center']);
    battle = choose(runtime, battle, { zone: 'center' });
    assert.equal(battle.pendingChoice, null);
    assert.deepEqual(battle.players[0].zones.center.cheer.map(card => card.id), ['green-archive']);
    assert.deepEqual(new Set(battle.players[0].archive.map(card => card.id)), new Set(['white-archive', 'red-archive']));
  });

  for (let die = 1; die <= 6; die += 1) {
    test(`${runtime.name}: hSD01-013 Arts die ${die} attaches on odd or draws on even`, () => {
      assert.equal(soraz.arts[0].damage, 50);
      assert.deepEqual(soraz.arts[0].cost, ['無色', '無色']);
      assert.match(soraz.arts[0].effect, /奇數.*牌庫頂的1張牌送給此Holomen.*偶數.*牌庫抽1張牌/u);
      let battle = state('hSD01-013', 'AUDIT-DUMMY');
      fund(battle.players[0].zones.center, soraz.arts[0].cost);
      battle.players[0].cheerDeck = [inst('hY02-001', `top-${die}`), inst('hY01-001', `next-${die}`)];
      battle.players[0].mainDeck = [inst('AUDIT-DUMMY', `draw-${die}`), ...battle.players[0].mainDeck.slice(1)];
      battle = applyAction(battle, 0, attack, pool, () => 0);
      assert.equal(battle.pendingChoice?.effect, 'sorazRoll');
      battle = choose(runtime, battle, { optionId: 'roll' }, dieRandom(die));
      if (die % 2 === 1) {
        assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
        assert.deepEqual(battle.pendingChoice.options, ['center']);
        battle = choose(runtime, battle, { zone: 'center' });
        assert.deepEqual(battle.players[0].zones.center.cheer.at(-1).id, `top-${die}`);
        assert.deepEqual(battle.players[0].cheerDeck.map(card => card.id), [`next-${die}`]);
        assert.equal(battle.players[0].hand.length, 0);
      } else {
        assert.equal(battle.pendingChoice, null);
        assert.deepEqual(battle.players[0].hand.map(card => card.id), [`draw-${die}`]);
        assert.deepEqual(battle.players[0].cheerDeck.map(card => card.id), [`top-${die}`, `next-${die}`]);
      }
      assert.equal(battle.players[1].zones.center.damage, 50);
    });
  }

  test(`${runtime.name}: hSD01-013 is recognized as both Sora and AZKi by other printed effects`, () => {
    const hSD01Sora = cards.find(card => card.number === 'hSD01-011');
    const hSD01Azki = cards.find(card => card.number === 'hSD01-006');
    assert.match(soraz.extra, /視為〈ときのそら〉與〈AZKi〉/u);

    let soraGate = state('hSD01-011', 'AUDIT-DUMMY');
    soraGate.players[0].zones.back1 = unit('hSD01-013');
    soraGate.players[0].cheerDeck = [inst('hY02-001', 'sora-alias-cheer')];
    fund(soraGate.players[0].zones.center, [hSD01Sora.arts[0].cost[0]]);
    soraGate = applyAction(soraGate, 0, { ...attack, artIndex: 0 }, pool, () => 0);
    assert.equal(soraGate.pendingChoice?.type, 'eventCheerTarget', 'SorAZ must satisfy the Sora stage gate');
    soraGate = choose(runtime, soraGate, { zone: 'back1' });
    assert.deepEqual(soraGate.players[0].zones.back1.cheer.map(card => card.id), ['sora-alias-cheer']);

    let azkiBonus = state('hSD01-006', 'AUDIT-DUMMY');
    azkiBonus.players[0].zones.back1 = unit('hSD01-013');
    fund(azkiBonus.players[0].zones.center, hSD01Azki.arts[1].cost);
    azkiBonus = applyAction(azkiBonus, 0, { ...attack, artIndex: 1 }, pool, () => 0);
    assert.equal(azkiBonus.players[1].zones.center.damage, hSD01Azki.arts[1].damage + 50, 'SorAZ must satisfy the AZKi Arts bonus gate');
  });
}
