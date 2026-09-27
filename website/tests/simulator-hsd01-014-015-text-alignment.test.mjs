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
const collab = (runtime, centerNumber, mainDeck = [], cheerDeck = []) => {
  let battle = state(centerNumber, 'AUDIT-DUMMY');
  battle.phase = 'main';
  battle.players[0].zones.center = unit(centerNumber);
  battle.players[0].zones.back1 = unit('hSD01-015');
  battle.players[0].mainDeck = mainDeck;
  battle.players[0].cheerDeck = cheerDeck;
  return runtime.applyAction(battle, 0, { type: 'collab', zone: 'back1' }, runtime.pool, () => 0);
};

for (const runtime of runtimes) {
  const { cards } = runtime;
  const sora = cards.find(card => card.group === 'holomem' && card.jpName === 'ときのそら' && card.stage === 'Debut');
  const azki = cards.find(card => card.group === 'holomem' && card.jpName === 'AZKi');
  const other = cards.find(card => card.group === 'holomem' && !['ときのそら', 'AZKi'].includes(card.jpName) && card.stage === 'Debut');
  assert.ok(sora && azki && other, 'catalog needs Sora, AZKi and an unrelated Holomem');

  for (const number of ['hSD01-014', 'hSD01-015']) {
    test(`${runtime.name}: ${number} Spot is deployed to Back, not used as a Bloom`, () => {
      const card = cards.find(candidate => candidate.number === number);
      assert.equal(card.stage, 'Spot');
      assert.match(card.extra, /(?:不能|無法)進行Bloom/u);
      let battle = state('AUDIT-DUMMY');
      battle.phase = 'main';
      battle.players[0].hand = [inst(card.number, 'spot')];
      battle.players[0].zones.center = unit(sora.number);
      battle = runtime.applyAction(battle, 0, { type: 'play', cardId: 'spot' }, runtime.pool, () => 0);
      assert.equal(battle.pendingChoice?.type, 'playHolomen');
      assert.deepEqual(battle.pendingChoice.options, ['back1', 'back2', 'back3', 'back4', 'back5']);
      battle = choose(runtime, battle, { zone: 'back1' });
      assert.equal(battle.players[0].zones.back1.stack.at(-1).number, card.number);
      assert.throws(() => runtime.applyAction(battle, 0, { type: 'play', cardId: 'spot' }, runtime.pool), /手牌中找不到/u);
    });
  }

  for (const [number, damage, cost] of [['hSD01-014', 30, ['白', '綠']], ['hSD01-015', 10, ['無色']]]) {
    test(`${runtime.name}: ${number} Arts has the printed damage and Cheer cost`, () => {
      const card = cards.find(candidate => candidate.number === number);
      assert.equal(card.arts[0].damage, damage);
      assert.deepEqual(card.arts[0].cost, cost);
      const battle = state(number, 'AUDIT-DUMMY');
      fund(battle.players[0].zones.center, cost);
      const result = runtime.applyAction(battle, 0, attack, runtime.pool, () => 0);
      assert.equal(result.players[1].zones.center.damage, damage);
    });
  }

  test(`${runtime.name}: hSD01-015 draws only when Center is Sora`, () => {
    const soraResult = collab(runtime, sora.number, [inst('AUDIT-DUMMY', 'power'), inst('AUDIT-DUMMY', 'draw')]);
    assert.deepEqual(soraResult.players[0].hand.map(card => card.id), ['draw']);
    assert.deepEqual(soraResult.players[0].holoPower.map(card => card.id), ['power']);
    assert.equal(soraResult.pendingChoice, null);
    assert.deepEqual(soraResult.players[0].cheerDeck, []);

    const otherResult = collab(runtime, other.number, [inst('AUDIT-DUMMY', 'unused')]);
    assert.deepEqual(otherResult.players[0].hand, []);
    assert.equal(otherResult.pendingChoice, null);
    assert.deepEqual(otherResult.players[0].mainDeck, []);
    assert.deepEqual(otherResult.players[0].holoPower.map(card => card.id), ['unused']);
  });

  test(`${runtime.name}: hSD01-015 AZKi branch attaches one top Cheer to Center`, () => {
    let battle = collab(runtime, azki.number, [inst('AUDIT-DUMMY', 'unused')], [inst('hY01-001', 'cheer-top'), inst('hY02-001', 'cheer-next')]);
    assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
    assert.deepEqual(battle.pendingChoice.options, ['center']);
    battle = choose(runtime, battle, { zone: 'center' });
    assert.deepEqual(battle.players[0].zones.center.cheer.map(card => card.id), ['cheer-top']);
    assert.deepEqual(battle.players[0].cheerDeck.map(card => card.id), ['cheer-next']);
    assert.deepEqual(battle.players[0].hand, []);
  });

  test(`${runtime.name}: hSD01-015 treats SorAZ Center as both Sora and AZKi`, () => {
    let battle = collab(runtime, 'hSD01-013', [inst('AUDIT-DUMMY', 'power'), inst('AUDIT-DUMMY', 'draw')], [inst('hY02-001', 'cheer-top')]);
    assert.deepEqual(battle.players[0].hand.map(card => card.id), ['draw']);
    assert.deepEqual(battle.players[0].holoPower.map(card => card.id), ['power']);
    assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
    assert.deepEqual(battle.pendingChoice.options, ['center']);
    battle = choose(runtime, battle, { zone: 'center' });
    assert.deepEqual(battle.players[0].zones.center.cheer.map(card => card.id), ['cheer-top']);
  });
}
