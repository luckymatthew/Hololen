import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act } from './hbp09-fixtures.mjs';

function irohaFixture({ center = 'hBP01-046', backAzki = null, opponentAzki = null, deck = [] } = {}) {
  const state = fixture(6, 64);
  const own = state.players[0];
  own.zones.center = unit(center);
  own.zones.collab = null;
  own.zones.back1 = backAzki ? unit(backAzki) : null;
  own.zones.back2 = unit('hBP09-036');
  own.cheerDeck = deck.map(instance);
  const opponent = state.players[1];
  if (opponentAzki) opponent.zones.center = unit(opponentAzki);
  return state;
}

function resolveCollab(state, sourceZone = 'back2') {
  return act(state, { type: 'collab', zone: sourceZone });
}

function chooseZone(state, zone) {
  const choice = state.pendingChoice;
  assert.equal(choice?.type, 'stageTarget');
  assert.ok(choice.options.includes(zone));
  return act(state, { type: 'choose', zone }, choice.playerIndex);
}

function chooseCard(state, number) {
  const choice = state.pendingChoice;
  assert.equal(choice?.type, 'cardSelection');
  const card = choice.cards.find(item => item.number === number);
  assert.ok(card, `${number} should be a legal Cheer choice`);
  return act(state, { type: 'choose', cardIds: [card.id] }, choice.playerIndex);
}

function artsFixture({ center = 'hBP01-046', centerCheers = 0, backAzki = null, backCheers = 0, opponentAzki = null, opponentCheers = 0 } = {}) {
  const state = fixture(6, 64);
  state.phase = 'performance';
  const own = state.players[0];
  own.zones.center = unit(center);
  own.zones.center.cheer = Array.from({ length: centerCheers }, (_, i) => instance(['hY01-015', 'hY02-013', 'hY03-017', 'hY04-014'][i % 4]));
  own.zones.collab = unit('hBP09-036', 1);
  own.zones.back1 = backAzki ? unit(backAzki, backCheers) : null;
  const opponent = state.players[1];
  if (opponentAzki) opponent.zones.center = unit(opponentAzki, opponentCheers);
  return state;
}

function attackIroha(state) {
  return act(state, { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' });
}

test('hBP09-036 R/SR identity and the live official Japanese Collab and Arts text match the catalog snapshot', () => {
  const card = cards.find(entry => entry.number === 'hBP09-036');
  assert.ok(card);
  assert.equal(card.jpName, '風真いろは');
  assert.equal(card.stage, '1st');
  assert.equal(card.hp, 160);
  assert.deepEqual(new Set(card.variants.map(variant => variant.rarity)), new Set(['R', 'SR']));
  assert.equal(card.keyword.effect, '自分のステージの〈AZKi〉1人を選ぶ。自分のエールデッキから、選んだホロメンと同色のエール1枚を選んだホロメンに送る。そしてエールデッキをシャッフルする。');
  assert.equal(card.arts[0].effect, '自分のセンターの〈AZKi〉のエール1枚につき、このアーツ+20。');
  assert.equal(card.arts[0].damage, 20);
  assert.deepEqual(card.arts[0].cost, ['無色']);
});

test('Collab can target own Center or back AZKi, ignores enemy AZKi, and attaches only a Cheer sharing the chosen AZKi color', () => {
  const state = irohaFixture({ center: 'hBP01-046', backAzki: 'hBP07-068', opponentAzki: 'hBP01-046', deck: ['hY02-013', 'hY05-012', 'hY06-012'] });
  let result = resolveCollab(state);
  assert.deepEqual(result.pendingChoice?.options, ['center', 'back1']);
  result = chooseZone(result, 'back1');
  assert.deepEqual(result.pendingChoice?.cards.map(card => card.number), ['hY05-012'], 'purple AZKi can take only purple Cheer');
  const chosen = result.pendingChoice.cards[0];
  result = act(result, { type: 'choose', cardIds: [chosen.id] }, result.pendingChoice.playerIndex);
  assert.equal(result.pendingChoice, null);
  assert.ok(result.players[0].zones.back1.cheer.some(card => card.id === chosen.id));
  assert.equal(result.players[0].zones.center.cheer.length, 0);
  assert.equal(result.players[1].zones.center.cheer.length, 0);
  assert.equal(result.players[0].cheerDeck.some(card => card.id === chosen.id), false);
  assert.equal(result.players[0].zones.collab.stack.at(-1).number, 'hBP09-036');
});

test('Collab matches green Cheer for green AZKi and can search past unrelated cards anywhere in the Cheer Deck', () => {
  const state = irohaFixture({ center: 'hBP01-046', deck: ['hY05-012', 'hY03-017', 'hY02-013'] });
  let result = chooseZone(resolveCollab(state), 'center');
  assert.deepEqual(result.pendingChoice?.cards.map(card => card.number), ['hY02-013']);
  const green = result.pendingChoice.cards[0];
  result = act(result, { type: 'choose', cardIds: [green.id] }, result.pendingChoice.playerIndex);
  assert.ok(result.players[0].zones.center.cheer.some(card => card.id === green.id));
  assert.equal(result.players[0].cheerDeck.length, 2);
});

test('the Collab shuffles the Cheer Deck even when the chosen AZKi has no matching Cheer', () => {
  const state = irohaFixture({ center: 'hBP07-068', deck: ['hY02-013', 'hY03-017', 'hY06-012'] });
  const before = state.players[0].cheerDeck.map(card => card.id);
  let result = chooseZone(resolveCollab(state), 'center');
  assert.equal(result.pendingChoice, null, 'no matching Cheer is selectable');
  const after = result.players[0].cheerDeck.map(card => card.id);
  assert.deepEqual(new Set(after), new Set(before));
  assert.notDeepEqual(after, before, 'the deterministic shuffle changes this multi-card ordering');
  assert.equal(result.players[0].zones.center.cheer.length, 0);
});

test('the Collab has no target and does not move Cheer if only the opponent has AZKi', () => {
  const state = irohaFixture({ center: 'hBP01-046', opponentAzki: 'hBP07-068', deck: ['hY05-012', 'hY02-013'] });
  state.players[0].zones.center = unit('hBP02-024');
  const before = state.players[0].cheerDeck.map(card => card.id);
  const result = resolveCollab(state);
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].zones.collab.stack.at(-1).number, 'hBP09-036');
  assert.deepEqual(result.players[0].cheerDeck.map(card => card.id), before);
  assert.equal(result.players[1].zones.center.cheer.length, 0);
});

test('the Arts gains exactly +20 per Cheer on the current top Center AZKi and retains the cost Cheer', () => {
  for (const count of [0, 1, 3]) {
    const state = artsFixture({ center: 'hBP01-046', centerCheers: count, backAzki: 'hBP07-068', backCheers: 5, opponentAzki: 'hBP01-046', opponentCheers: 4 });
    const costIds = state.players[0].zones.collab.cheer.map(card => card.id);
    const result = attackIroha(state);
    assert.equal(result.pendingChoice, null);
    assert.equal(result.players[1].zones.center.damage, 20 + 20 * count);
    assert.equal(result.players[0].zones.collab.rested, true);
    assert.deepEqual(result.players[0].zones.collab.cheer.map(card => card.id), costIds);
  }
});

test('Arts ignores AZKi Cheer outside own Center and ignores an AZKi covered by a different top Holomem', () => {
  const state = artsFixture({ center: 'hBP01-046', centerCheers: 4, backAzki: 'hBP07-068', backCheers: 5, opponentAzki: 'hBP01-046', opponentCheers: 6 });
  state.players[0].zones.center.stack.push(instance('hBP02-024'));
  const result = attackIroha(state);
  assert.equal(result.players[1].zones.center.damage, 20, 'the top Center card is Mio, not AZKi; other AZKi Cheer is excluded');
});
