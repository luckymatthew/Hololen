import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, state, unit, inst, fund } from './fixtures/simulator-audit.mjs';

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
const play = (runtime, battle, id, random = () => 0) => runtime.applyAction(battle, 0, { type: 'play', cardId: id }, runtime.pool, random);
const dieRandom = die => () => (die - 0.5) / 6;
const main = (source = 'AUDIT-DUMMY') => {
  const battle = state(source, 'AUDIT-DUMMY');
  battle.phase = 'main';
  return battle;
};

for (const runtime of runtimes) {
  const { cards } = runtime;
  const firstStage = cards.find(card => card.group === 'holomem' && card.stage === '1st' && !String(card.type).toUpperCase().includes('BUZZ'));
  const secondStage = cards.find(card => card.group === 'holomem' && card.stage === '2nd' && !String(card.type).toUpperCase().includes('BUZZ'));
  const buzzFirst = cards.find(card => card.group === 'holomem' && card.stage === '1st' && String(card.type).toUpperCase().includes('BUZZ'));
  const debut = cards.find(card => card.group === 'holomem' && card.stage === 'Debut');
  const sora = cards.find(card => card.group === 'holomem' && card.jpName === 'ときのそら');
  const azki = cards.find(card => card.group === 'holomem' && card.jpName === 'AZKi');
  const soraz = cards.find(card => card.number === 'hSD01-013');
  const limitedSupport = cards.find(card => card.group === 'support' && String(card.type).toUpperCase().includes('LIMITED') && card.number !== 'hSD01-018');
  const ordinarySupport = cards.find(card => card.group === 'support' && !String(card.type).toUpperCase().includes('LIMITED'));
  assert.ok(firstStage && secondStage && buzzFirst && debut && sora && azki && soraz && limitedSupport && ordinarySupport, 'catalog needs support and stage fixtures');

  test(`${runtime.name}: hSD01-016 draws the top three and consumes the turn's LIMITED allowance`, () => {
    let battle = main();
    battle.players[0].hand = [inst('hSD01-016', 'staff'), inst('hSD01-017', 'next-limited')];
    battle.players[0].mainDeck = [inst('AUDIT-DUMMY', 'one'), inst('AUDIT-DUMMY', 'two'), inst('AUDIT-DUMMY', 'three'), inst('AUDIT-DUMMY', 'four')];
    battle = play(runtime, battle, 'staff');
    assert.deepEqual(battle.players[0].hand.map(card => card.id), ['next-limited', 'one', 'two', 'three']);
    assert.deepEqual(battle.players[0].mainDeck.map(card => card.id), ['four']);
    assert.equal(battle.players[0].limitedUsesCount, 1);
    assert.throws(() => play(runtime, battle, 'next-limited'), /最多只可使用 1 張 LIMITED/u);
  });

  test(`${runtime.name}: hSD01-017 requires another hand card, shuffles the rest and draws five`, () => {
    let blocked = main();
    blocked.players[0].hand = [inst('hSD01-017', 'manager')];
    assert.throws(() => play(runtime, blocked, 'manager'), /最少要有 1 張手牌/u);
    assert.deepEqual(blocked.players[0].hand.map(card => card.id), ['manager'], 'failed play leaves hand intact');

    let battle = main();
    battle.players[0].hand = [inst('hSD01-017', 'manager'), inst('AUDIT-DUMMY', 'hand-one'), inst('AUDIT-DUMMY', 'hand-two')];
    battle.players[0].mainDeck = Array.from({ length: 6 }, (_, index) => inst('AUDIT-DUMMY', `deck-${index}`));
    battle = play(runtime, battle, 'manager', () => 0.5);
    assert.equal(battle.players[0].hand.length, 5);
    assert.equal(battle.players[0].mainDeck.length, 3);
    assert.equal(battle.players[0].limitedUsesCount, 1);
    assert.ok(battle.players[0].archive.some(card => card.id === 'manager'));
    const movedIds = new Set([...battle.players[0].hand, ...battle.players[0].mainDeck].map(card => card.id));
    assert.deepEqual(movedIds, new Set(['hand-one', 'hand-two', 'deck-0', 'deck-1', 'deck-2', 'deck-3', 'deck-4', 'deck-5']));
  });

  test(`${runtime.name}: hSD01-018 views exactly five and selects only a LIMITED Support`, () => {
    let battle = main();
    battle.players[0].hand = [inst('hSD01-018', 'backup')];
    battle.players[0].mainDeck = [inst(ordinarySupport.number, 'ordinary'), inst(limitedSupport.number, 'limited'), inst('AUDIT-DUMMY', 'three'), inst('AUDIT-DUMMY', 'four'), inst('AUDIT-DUMMY', 'five'), inst('AUDIT-DUMMY', 'sixth')];
    battle = play(runtime, battle, 'backup');
    assert.equal(battle.pendingChoice?.effect, 'topLookToHand');
    assert.deepEqual(battle.pendingChoice.selectableIds, ['limited']);
    assert.equal(battle.pendingChoice.min, 1);
    battle = choose(runtime, battle, { cardIds: ['limited'] });
    assert.equal(battle.pendingChoice?.effect, 'bottomOrder');
    battle = choose(runtime, battle, { cardIds: ['ordinary', 'three', 'four', 'five'] });
    assert.deepEqual(battle.players[0].hand.map(card => card.id), ['limited']);
    assert.deepEqual(battle.players[0].mainDeck.map(card => card.id), ['sixth', 'ordinary', 'three', 'four', 'five']);
  });

  test(`${runtime.name}: hSD01-019 pays one stage Cheer before searching a non-Buzz 1st or 2nd`, () => {
    let battle = main();
    battle.players[0].hand = [inst('hSD01-019', 'computer')];
    fund(battle.players[0].zones.center, ['紅']);
    battle.players[0].mainDeck = [inst(firstStage.number, 'valid-first'), inst(secondStage.number, 'valid-second'), inst(buzzFirst.number, 'buzz-first'), inst(debut.number, 'debut')];
    battle = play(runtime, battle, 'computer');
    assert.equal(battle.pendingChoice?.type, 'payStageCheerForSearch');
    assert.deepEqual(battle.pendingChoice.options, ['cheer0']);
    battle = choose(runtime, battle, { cheerId: 'cheer0' });
    assert.equal(battle.pendingChoice?.effect, 'deckToHandShuffle');
    assert.deepEqual(new Set(battle.pendingChoice.selectableIds), new Set(['valid-first', 'valid-second']));
    battle = choose(runtime, battle, { cardIds: ['valid-second'] });
    assert.ok(battle.players[0].hand.some(card => card.id === 'valid-second'));
    assert.ok(battle.players[0].archive.some(card => card.id === 'cheer0'));
    assert.ok(battle.players[0].archive.some(card => card.id === 'computer'));
    assert.equal(battle.players[0].limitedUsesCount, 1);
    const noCost = main();
    noCost.players[0].hand = [inst('hSD01-019', 'computer')];
    assert.throws(() => play(runtime, noCost, 'computer'), /需要將舞台上的 1 張應援/u);
  });

  for (let die = 1; die <= 6; die += 1) {
    test(`${runtime.name}: hSD01-020 die ${die} attaches one archived Cheer only on 3+`, () => {
      let battle = main();
      battle.players[0].hand = [inst('hSD01-020', 'ring')];
      battle.players[0].archive = [inst('hY01-001', 'archive-cheer')];
      battle = play(runtime, battle, 'ring', dieRandom(die));
      if (die >= 3) {
        assert.equal(battle.pendingChoice?.effect, 'archiveCheerToStage');
        assert.equal(battle.pendingChoice.min, 1);
        assert.deepEqual(battle.pendingChoice.selectableIds, ['archive-cheer']);
        battle = choose(runtime, battle, { cardIds: ['archive-cheer'] });
        assert.deepEqual(battle.pendingChoice?.options, ['center']);
        battle = choose(runtime, battle, { zone: 'center' });
        assert.deepEqual(battle.players[0].zones.center.cheer.map(card => card.id), ['archive-cheer']);
        assert.ok(!battle.players[0].archive.some(card => card.id === 'archive-cheer'));
      } else {
        assert.equal(battle.pendingChoice, null);
        assert.ok(battle.players[0].archive.some(card => card.id === 'archive-cheer'));
        assert.equal(battle.players[0].zones.center.cheer.length, 0);
      }
    });
  }

  test(`${runtime.name}: hSD01-021 hand ceiling is six other cards and top-four search accepts both names/aliases`, () => {
    let blocked = main();
    blocked.players[0].hand = [inst('hSD01-021', 'gravity'), ...Array.from({ length: 7 }, (_, index) => inst('AUDIT-DUMMY', `extra-${index}`))];
    assert.throws(() => play(runtime, blocked, 'gravity'), /手牌不可多於 6 張/u);
    assert.equal(blocked.players[0].hand.length, 8);

    let battle = main();
    battle.players[0].hand = [inst('hSD01-021', 'gravity'), ...Array.from({ length: 6 }, (_, index) => inst('AUDIT-DUMMY', `held-${index}`))];
    battle.players[0].mainDeck = [inst(sora.number, 'sora'), inst(azki.number, 'azki'), inst(soraz.number, 'soraz'), inst('AUDIT-DUMMY', 'filler'), inst(debut.number, 'fifth')];
    battle = play(runtime, battle, 'gravity');
    assert.equal(battle.pendingChoice?.effect, 'topLookToHand');
    assert.equal(battle.pendingChoice.min, 0, 'any number, including zero, is allowed');
    assert.deepEqual(new Set(battle.pendingChoice.selectableIds), new Set(['sora', 'azki', 'soraz']));
    battle = choose(runtime, battle, { cardIds: ['sora', 'azki', 'soraz'] });
    assert.equal(battle.pendingChoice?.effect, 'bottomOrder');
    battle = choose(runtime, battle, { cardIds: ['filler'] });
    assert.ok(['sora', 'azki', 'soraz'].every(id => battle.players[0].hand.some(card => card.id === id)));
    assert.deepEqual(battle.players[0].mainDeck.map(card => card.id), ['fifth', 'filler']);
    assert.equal(battle.players[0].limitedUsesCount, 1);
  });

  test(`${runtime.name}: hSD01-021 may choose zero matching Holomen and return all four in chosen order`, () => {
    let battle = main();
    battle.players[0].hand = [inst('hSD01-021', 'gravity')];
    battle.players[0].mainDeck = Array.from({ length: 4 }, (_, index) => inst('AUDIT-DUMMY', `filler-${index}`));
    battle = play(runtime, battle, 'gravity');
    assert.equal(battle.pendingChoice?.effect, 'bottomOrder');
    assert.equal(battle.pendingChoice.cards.length, 4);
    battle = choose(runtime, battle, { cardIds: ['filler-2', 'filler-0', 'filler-3', 'filler-1'] });
    assert.deepEqual(battle.players[0].mainDeck.map(card => card.id), ['filler-2', 'filler-0', 'filler-3', 'filler-1']);
    assert.deepEqual(battle.players[0].hand, []);
  });
}
