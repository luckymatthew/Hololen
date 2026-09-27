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
const dieRandom = die => (die - 0.5) / 6;

for (const runtime of runtimes) {
  const { applyAction, cards, pool } = runtime;
  const azki = cards.find(card => card.number === 'hSD01-010');
  const sora = cards.find(card => card.group === 'holomem' && card.jpName === 'ときのそら' && card.stage === 'Debut');
  const blueTarget = cards.filter(card => card.group === 'holomem' && card.colors.includes('藍')).sort((left, right) => right.hp - left.hp)[0];
  assert.ok(azki && sora && blueTarget, 'catalog needs AZKi, Sora and a Blue target');

  test(`${runtime.name}: hSD01-010 Green/Colorless Arts deals its printed 50`, () => {
    assert.equal(azki.arts[0].damage, 50);
    assert.deepEqual(azki.arts[0].cost, ['綠', '無色']);
    const battle = state('hSD01-010');
    fund(battle.players[0].zones.center, ['綠', '無色']);
    const result = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(result.players[1].zones.center.damage, 50);
  });

  test(`${runtime.name}: hSD01-011 first Arts attaches Cheer only with Sora on own stage; Blue target gets +50`, () => {
    const card = cards.find(candidate => candidate.number === 'hSD01-011');
    assert.equal(card.arts[0].damage, 60);
    assert.deepEqual(card.arts[0].cost, ['綠']);
    assert.deepEqual(card.arts[0].specialTargets, ['藍']);
    assert.deepEqual(card.arts[0].specialValues, [50]);

    let withoutSora = state('hSD01-011', blueTarget.number);
    fund(withoutSora.players[0].zones.center, ['綠']);
    withoutSora.players[0].cheerDeck = [inst('hY02-001', 'unused-without-sora')];
    withoutSora = applyAction(withoutSora, 0, { ...attack, artIndex: 0 }, pool, () => 0);
    assert.equal(withoutSora.players[1].zones.center.damage, 110);
    assert.equal(withoutSora.pendingChoice, null, 'AZKi does not attach Cheer when Sora is absent');
    assert.deepEqual(withoutSora.players[0].cheerDeck.map(card => card.id), ['unused-without-sora']);

    let withSora = state('hSD01-011', 'AUDIT-DUMMY');
    fund(withSora.players[0].zones.center, ['綠']);
    withSora.players[0].zones.back1 = unit(sora.number);
    withSora.players[0].cheerDeck = [inst('hY02-001', 'sora-gated-top')];
    withSora = applyAction(withSora, 0, { ...attack, artIndex: 0 }, pool, () => 0);
    assert.equal(withSora.pendingChoice?.type, 'eventCheerTarget');
    assert.deepEqual(withSora.pendingChoice.options, ['center', 'back1']);
    withSora = choose(runtime, withSora, { zone: 'back1' });
    assert.equal(withSora.players[1].zones.center.damage, 60);
    assert.deepEqual(withSora.players[0].zones.back1.cheer.map(card => card.id), ['sora-gated-top']);
    assert.equal(withSora.pendingChoice, null);
  });

  for (let die = 1; die <= 6; die += 1) {
    test(`${runtime.name}: hSD01-011 second Arts die ${die} applies odd/one bonuses independently`, () => {
      const card = cards.find(candidate => candidate.number === 'hSD01-011');
      assert.equal(card.arts[1].damage, 100);
      assert.deepEqual(card.arts[1].cost, ['綠', '綠', '無色']);
      assert.deepEqual(card.arts[1].specialTargets, ['藍']);
      assert.deepEqual(card.arts[1].specialValues, [50]);
      let battle = state('hSD01-011', 'AUDIT-DUMMY');
      fund(battle.players[0].zones.center, card.arts[1].cost);
      battle = applyAction(battle, 0, { ...attack, artIndex: 1 }, pool, () => 0);
      assert.equal(battle.pendingChoice?.effect, 'starterAzkiRoll');
      battle = choose(runtime, battle, { optionId: 'roll' }, () => dieRandom(die));
      const expectedRollBonus = die % 2 === 1 ? 50 + (die === 1 ? 50 : 0) : 0;
      assert.equal(battle.players[1].zones.center.damage, 100 + expectedRollBonus);
    });
  }

  test(`${runtime.name}: hSD01-011 second Arts also receives the printed Blue-target bonus`, () => {
    const card = cards.find(candidate => candidate.number === 'hSD01-011');
    let battle = state('hSD01-011', blueTarget.number);
    fund(battle.players[0].zones.center, card.arts[1].cost);
    battle = applyAction(battle, 0, { ...attack, artIndex: 1 }, pool, () => 0);
    battle = choose(runtime, battle, { optionId: 'roll' }, () => dieRandom(2));
    assert.equal(battle.players[1].zones.center.damage, 150, 'even die adds no dice bonus; Blue adds exactly 50');
  });
}
