import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, conserve } from './hbp09-fixtures.mjs';

function bloomFixture(deck) {
  const state = fixture();
  state.turn = 8;
  state.firstPlayer = 1;
  state.activePlayer = 0;
  state.phase = 'main';
  const player = state.players[0];
  for (const stage of Object.values(player.zones)) {
    if (stage) player.archive.push(...stage.stack, ...stage.cheer, ...stage.attachments);
  }
  player.zones = { center: unit('hBP09-026'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  player.zones.center.enteredTurn = 1;
  player.hand = [instance('hBP09-028')];
  player.archive.push(...player.mainDeck);
  player.mainDeck = deck.map(instance);
  player.turnsTaken = 3;
  player.turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  return state;
}

function bloom028(state, random = () => 0.4) {
  const bloom = state.players[0].hand.find(card => card.number === 'hBP09-028');
  let next = act(state, { type: 'play', cardId: bloom.id }, 0, cards, random);
  assert.equal(next.pendingChoice?.type, 'bloom', 'a 1st Noel may Bloom onto the staged Debut Noel');
  next = act(next, { type: 'choose', zone: 'center' }, 0, cards, random);
  return next;
}

test('hBP09-028 reveals and adds one Gyudon from its real Bloom path, then shuffles once', () => {
  const card = cards.find(entry => entry.number === 'hBP09-028');
  const gyudon = cards.find(entry => entry.number === 'hBP09-100');
  assert.ok(card && gyudon);
  assert.equal(card.jpName, '白銀ノエル');
  assert.equal(card.stage, '1st');
  assert.equal(card.hp, 150);
  assert.equal(card.keyword?.name, 'ノエルの冒険');
  assert.equal(card.keyword?.effect, '自分のデッキから、〈牛丼〉1枚を公開し、手札に加える。そしてデッキをシャッフルする。');
  assert.ok(gyudon.jpName.includes('牛丼'), 'the positive control is the official hBP09 special Gyudon');

  const initial = bloomFixture(['hBP09-100', 'hBP09-104', 'hBP09-098', 'hBP09-093']);
  const before = structuredClone(initial);
  let randomCalls = 0;
  let state = bloom028(initial, () => { randomCalls += 1; return 0.4; });
  assert.equal(state.pendingChoice?.type, 'cardSelection');
  assert.deepEqual(state.pendingChoice.selectableIds.map(id => state.players[0].mainDeck.find(card => card.id === id)?.number), ['hBP09-100']);
  assert.equal(randomCalls, 0, 'the deck must not be shuffled before the revealed target is selected');

  state = act(state, { type: 'choose', cardIds: state.pendingChoice.selectableIds }, 0, cards, () => { randomCalls += 1; return 0.4; });
  assert.equal(state.pendingChoice, null);
  assert.deepEqual(state.players[0].hand.map(card => card.number), ['hBP09-100']);
  assert.equal(state.players[0].mainDeck.length, 3);
  assert.equal(randomCalls, 2, 'the final three-card deck gets one Fisher-Yates shuffle');
  assert.ok(state.log.some(entry => /hBP09-100/u.test(JSON.stringify(entry))), 'the searched card is revealed in the public resolution log');
  conserve(before, state);
});

test('hBP09-028 still shuffles once when the deck has no Gyudon target (Q751 search boundary)', () => {
  const initial = bloomFixture(['hBP09-104', 'hBP09-098', 'hBP09-093', 'hBP09-102']);
  const before = structuredClone(initial);
  let randomCalls = 0;
  const state = bloom028(initial, () => { randomCalls += 1; return 0.4; });
  assert.equal(state.pendingChoice, null, 'a mandatory search with no eligible card resolves without a choice');
  assert.equal(state.players[0].hand.length, 0);
  assert.equal(state.players[0].mainDeck.length, 4);
  assert.equal(randomCalls, 3, 'the four-card deck is shuffled exactly once even when the search misses');
  conserve(before, state);
});

test('hBP09-028 search accepts only cards carrying the printed Gyudon identity and preserves all other deck cards', () => {
  const initial = bloomFixture(['hBP09-100', 'hBP09-104', 'hBP09-098']);
  const before = structuredClone(initial);
  let randomCalls = 0;
  let state = bloom028(initial, () => { randomCalls += 1; return 0.4; });
  assert.equal(state.pendingChoice?.selectableIds.length, 1);
  assert.equal(state.players[0].mainDeck.length, 3, 'search leaves the card in the deck until the selection is confirmed');
  assert.throws(() => act(state, { type: 'choose', cardIds: [state.players[0].mainDeck.find(card => card.number === 'hBP09-104').id] }), /invalid|eligible|select|choice|選択/iu,
    'a non-Gyudon card cannot be selected as the search result');
  state = act(state, { type: 'choose', cardIds: state.pendingChoice.selectableIds }, 0, cards, () => { randomCalls += 1; return 0.4; });
  assert.deepEqual(state.players[0].hand.map(card => card.number), ['hBP09-100']);
  assert.deepEqual(new Set(state.players[0].mainDeck.map(card => card.number)), new Set(['hBP09-104', 'hBP09-098']));
  assert.equal(randomCalls, 1, 'the two-card remaining deck gets one Fisher-Yates random step');
  conserve(before, state);
});
