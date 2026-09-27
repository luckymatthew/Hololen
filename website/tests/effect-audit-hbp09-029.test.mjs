import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, settle, conserve } from './hbp09-fixtures.mjs';

const green = count => Array.from({ length: count }, () => instance('hY02-013'));
const white = count => Array.from({ length: count }, () => instance('hY01-015'));

function replaceStage(player, zones) {
  for (const old of Object.values(player.zones)) {
    if (old) player.archive.push(...old.stack, ...old.cheer, ...old.attachments);
  }
  player.zones = { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null, ...zones };
}

function setMainDeck(player, numbers) {
  player.archive.push(...player.mainDeck);
  player.mainDeck = numbers.map(instance);
}

function searchArtsFixture(deck) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'performance';
  const source = state.players[0];
  replaceStage(source, { center: unit('hBP09-029') });
  source.zones.center.cheer = green(3);
  source.hand = [];
  setMainDeck(source, deck);
  source.turnsTaken = 3;
  source.turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  const opponent = state.players[1];
  replaceStage(opponent, { center: unit('hBP09-064') });
  opponent.turnsTaken = 3;
  return state;
}

function downFixture({ top = 'hBP09-029', priorDamage = 190 } = {}) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'performance';
  replaceStage(state.players[0], { center: unit('hBP09-023') });
  state.players[0].zones.center.cheer = white(3);
  state.players[0].turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  const defender = state.players[1];
  replaceStage(defender, {
    center: unit(top),
    back1: unit('hBP09-064'),
  });
  if (top === 'hBP09-031') {
    defender.zones.center.stack = [instance('hBP09-029'), instance('hBP09-031')];
  }
  defender.zones.center.damage = priorDamage;
  defender.archive.push(...defender.life);
  defender.life = ['hY01-015', 'hY02-013', 'hY03-017', 'hY04-014', 'hY05-012'].map(instance);
  defender.turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  return state;
}

function attack029(state, random = () => 0.4) {
  return act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, cards, random);
}

test('hBP09-029 R/S identity and both Japanese clauses match the official catalog source', () => {
  const card = cards.find(entry => entry.number === 'hBP09-029');
  assert.ok(card);
  assert.equal(card.jpName, '白銀ノエル');
  assert.equal(card.typeCode, 'buzzCharacter');
  assert.equal(card.stage, '1st');
  assert.equal(card.hp, 260);
  assert.deepEqual(new Set(card.variants.map(variant => variant.rarity)), new Set(['R', 'SR']));
  assert.equal(card.arts[0].name, 'BIG3懇親会 side N');
  assert.deepEqual(card.arts[0].cost, ['綠', '綠', '無色']);
  assert.equal(card.arts[0].damage, 100);
  assert.equal(card.arts[0].effect, '自分のデッキから、2nd〈白銀ノエル〉1枚を公開し、手札に加える。そしてデッキをシャッフルする。');
  assert.equal(card.extra, 'このホロメンがダウンした時、自分のライフ-2');
});

test('hBP09-029 Arts searches every 2nd Noel, rejects another 2nd Holomem, then shuffles and deals 100', () => {
  const deck = ['hBP05-012', 'hBP07-022', 'hBP09-030', 'hBP09-031', 'hBP09-022', 'hBP09-104'];
  const state = searchArtsFixture(deck);
  const before = structuredClone(state);
  let randomCalls = 0;
  let result = attack029(state, () => { randomCalls += 1; return 0.4; });
  assert.equal(result.pendingChoice?.type, 'cardSelection');
  const expectedNoels = ['hBP05-012', 'hBP07-022', 'hBP09-030', 'hBP09-031'];
  assert.deepEqual(result.pendingChoice.selectableIds.map(id => result.players[0].mainDeck.find(card => card.id === id)?.number), expectedNoels);
  assert.equal(result.players[1].zones.center.damage, 0, 'the Arts damage waits until the search choice is resolved');
  assert.equal(randomCalls, 0, 'the remaining deck is not shuffled before the search result is selected');
  const illegalTarget = result.players[0].mainDeck.find(card => card.number === 'hBP09-022');
  const pendingBefore = JSON.stringify(result);
  assert.throws(() => act(result, { type: 'choose', cardIds: [illegalTarget.id] }, 0, cards), /not selectable|選択できません/iu);
  assert.equal(JSON.stringify(result), pendingBefore, 'an illegal non-Noel choice leaves the pending state intact');
  result = act(result, { type: 'choose', cardIds: [result.pendingChoice.selectableIds.at(-1)] }, 0, cards, () => { randomCalls += 1; return 0.4; });
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[1].zones.center.damage, 100);
  assert.deepEqual(result.players[0].hand.map(card => card.number), ['hBP09-031']);
  assert.equal(result.players[0].mainDeck.length, 5);
  assert.equal(randomCalls, 4, 'one shuffle is applied after adding the selected card to hand');
  conserve(before, result);
});

test('hBP09-029 Arts still shuffles once and deals 100 when no 2nd Noel is in the deck (Q751)', () => {
  const state = searchArtsFixture(['hBP09-022', 'hBP09-023', 'hBP09-104', 'hBP09-100']);
  const before = structuredClone(state);
  let randomCalls = 0;
  const result = attack029(state, () => { randomCalls += 1; return 0.4; });
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].hand.length, 0);
  assert.equal(result.players[1].zones.center.damage, 100);
  assert.equal(result.players[0].mainDeck.length, 4);
  assert.equal(randomCalls, 3, 'the printed shuffle remains mandatory despite a missed search');
  conserve(before, result);
});

test('an actual Arts Down of hBP09-029 replaces the normal one Life loss with exactly two and attaches the latest Life cards', () => {
  const state = downFixture({ top: 'hBP09-029', priorDamage: 190 });
  const before = structuredClone(state);
  const expectedLatestLifeIds = state.players[1].life.slice(-2).reverse().map(card => card.id);
  const result = settle(act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, cards), cards);
  assert.equal(result.players[1].zones.center, null);
  assert.equal(result.players[1].life.length, 3, 'Buzz Q196 replaces -1 with -2 instead of adding -2 to make -3');
  assert.equal(result.lifeLosses.filter(loss => loss.ownerIndex === 1).length, 2);
  assert.deepEqual(result.players[1].zones.back1.cheer.map(card => card.id), expectedLatestLifeIds);
  assert.equal(result.players[1].zones.back1.cheer.length, 2);
  conserve(before, result);
});

test('the -2 Extra belongs to active-top Buzz 029; ordinary Noel and covered Buzz each use the normal one Life loss', () => {
  for (const scenario of [
    { top: 'hBP09-027', priorDamage: 40, expectedLife: 4, label: 'ordinary 1st Noel' },
    { top: 'hBP09-031', priorDamage: 100, expectedLife: 4, label: 'non-Buzz Noel covering Buzz 029' },
  ]) {
    const state = downFixture(scenario);
    const result = settle(act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, cards), cards);
    assert.equal(result.players[1].zones.center, null, scenario.label);
    assert.equal(result.players[1].life.length, scenario.expectedLife, `${scenario.label}: only the ordinary one Life is lost`);
    assert.equal(result.lifeLosses.filter(loss => loss.ownerIndex === 1).length, 1);
    assert.equal(result.players[1].zones.back1.cheer.length, 1);
  }
});
