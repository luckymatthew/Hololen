import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, conserve } from './hbp09-fixtures.mjs';

function collabFixture({ firstPlayer = 1, turnsTaken = 1, searchedDeck = [] } = {}) {
  const state = fixture();
  state.turn = firstPlayer === 0 && turnsTaken === 1 ? 1 : firstPlayer === 1 && turnsTaken === 1 ? 2 : 4;
  state.firstPlayer = firstPlayer;
  state.activePlayer = 0;
  state.phase = 'main';
  state.players[0].turnsTaken = turnsTaken;
  state.players[0].zones.back1 = unit('hBP09-026');
  state.players[0].mainDeck = [instance('hBP09-026'), ...searchedDeck.map(instance)];
  state.players[0].turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  return state;
}

function countedRandom() {
  let calls = 0;
  return Object.assign(() => ((calls++ % 7) + 1) / 8, { count: () => calls });
}

function collab(state, random) {
  return act(state, { type: 'collab', zone: 'back1' }, 0, cards, random);
}

function choose(state, cardIds, random) {
  assert.equal(state.pendingChoice?.type, 'cardSelection');
  return act(state, { type: 'choose', cardIds }, state.pendingChoice.playerIndex, cards, random);
}

test('hBP09-026 official identity, exact Japanese search text, and ordinary Arts match', () => {
  const card = cards.find(entry => entry.number === 'hBP09-026');
  assert.ok(card);
  assert.equal(card.jpName, '白銀ノエル');
  assert.equal(card.group, 'holomem');
  assert.equal(card.stage, 'Debut');
  assert.equal(card.hp, 140);
  assert.deepEqual(card.variants.map(variant => variant.rarity), ['U']);
  assert.equal(card.keyword?.type, 'collab');
  assert.equal(card.keyword.name, 'マッスル・グレイス');
  assert.equal(card.keyword.effect, '自分が後攻で最初のターンなら、自分のデッキから、[Debut〈白銀ノエル〉と〈牛丼〉]1枚ずつを公開し、手札に加える。そしてデッキをシャッフルする。');
  assert.equal(card.arts[0].name, '慈愛の鉄槌');
  assert.equal(card.arts[0].damage, 20);
  assert.deepEqual(card.arts[0].cost, ['綠']);
  assert.equal(card.arts[0].effect, '');
});

test('hBP09-026 reveals one eligible Debut Noel and one Gyudon, then shuffles once after both choices', () => {
  const random = countedRandom();
  const state = collabFixture({ searchedDeck: ['hBP09-025', 'hBP09-100', 'hBP09-104', 'hBP09-098'] });
  const before = structuredClone(state);
  const resultAfterCollab = collab(state, random);
  assert.equal(resultAfterCollab.pendingChoice?.type, 'cardSelection');
  assert.deepEqual(new Set(resultAfterCollab.pendingChoice.cards.map(card => card.number)), new Set(['hBP09-025']));
  assert.equal(random.count(), 0, 'the deck is not shuffled between the two searches');

  const noel = resultAfterCollab.pendingChoice.cards[0];
  let result = choose(resultAfterCollab, [noel.id], random);
  assert.equal(result.pendingChoice?.type, 'cardSelection');
  assert.deepEqual(new Set(result.pendingChoice.cards.map(card => card.number)), new Set(['hBP09-100']), 'the official deck recipe confirms Noel’s Special Gyudon is also a 〈牛丼〉');
  assert.equal(random.count(), 0, 'no shuffle occurs before the Gyudon search is resolved');

  const gyudon = result.pendingChoice.cards[0];
  result = choose(result, [gyudon.id], random);
  assert.equal(result.pendingChoice, null);
  assert.deepEqual(new Set(result.players[0].hand.map(card => card.number)), new Set(['hBP09-025', 'hBP09-100']));
  assert.equal(random.count(), result.players[0].mainDeck.length - 1, 'one final Fisher-Yates shuffle runs after both searches');
  conserve(before, result);
});

test('hBP09-026 can fail to find Noel while still resolving Gyudon, with one final shuffle', () => {
  const random = countedRandom();
  const state = collabFixture({ searchedDeck: ['hBP09-100', 'hBP09-104', 'hBP09-098'] });
  let result = collab(state, random);
  assert.equal(result.pendingChoice?.type, 'cardSelection', 'an absent first search advances to the available second search');
  assert.deepEqual(result.pendingChoice.cards.map(card => card.number), ['hBP09-100']);
  assert.equal(random.count(), 0, 'the absent Noel group does not trigger an early shuffle');
  const gyudon = result.pendingChoice.cards[0];
  result = choose(result, [gyudon.id], random);
  assert.equal(result.pendingChoice, null);
  assert.deepEqual(result.players[0].hand.map(card => card.number), ['hBP09-100']);
  assert.equal(random.count(), result.players[0].mainDeck.length - 1, 'the combined effect shuffles the remaining deck once');
});

test('hBP09-026 still performs the required shuffle when both hidden searches find no card (Q751)', () => {
  const random = countedRandom();
  const state = collabFixture({ searchedDeck: ['hBP09-104', 'hBP09-098', 'hBP09-093'] });
  const result = collab(state, random);
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].hand.length, 0);
  assert.equal(random.count(), result.players[0].mainDeck.length - 1, 'Q751 and Comprehensive Rules §5.6.1 require one shuffle after an unproductive search');
});

test('hBP09-026 Collab search is limited to the second player’s first turn', () => {
  for (const [firstPlayer, turnsTaken] of [[0, 1], [1, 2]]) {
    const random = countedRandom();
    const state = collabFixture({ firstPlayer, turnsTaken, searchedDeck: ['hBP09-025', 'hBP09-100'] });
    const result = collab(state, random);
    assert.equal(result.pendingChoice, null, `firstPlayer=${firstPlayer}, turnsTaken=${turnsTaken}`);
    assert.equal(result.players[0].zones.collab.stack.at(-1).number, 'hBP09-026');
    assert.equal(random.count(), 0, 'the ordinary Collab action uses no search/shuffle outside the printed timing window');
  }
});
