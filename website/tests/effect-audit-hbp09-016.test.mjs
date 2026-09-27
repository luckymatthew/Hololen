import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, conserve } from './hbp09-fixtures.mjs';

const eligibleHajime = cards.filter(card => card.group === 'holomem' && card.jpName === '轟はじめ' && Number(card.baton || 0) === 1);
const eligibleNumbers = [...new Set(eligibleHajime.map(card => card.number))].sort();

function collabFixture({ firstPlayer = 1, turnsTaken = 1, matching = eligibleNumbers, includeNoMatch = true } = {}) {
  const state = fixture();
  state.turn = firstPlayer === 0 && turnsTaken === 1 ? 1 : turnsTaken === 1 ? 2 : 4;
  state.firstPlayer = firstPlayer;
  state.activePlayer = 0;
  state.phase = 'main';
  state.players[0].turnsTaken = turnsTaken;
  state.players[1].turnsTaken = firstPlayer === 1 && turnsTaken === 1 ? 1 : 2;
  state.players[0].turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  state.players[0].zones.back1 = unit('hBP09-016');
  state.players[0].mainDeck = [
    instance('hBP09-016'), // ordinary Collab Holo Power card; baton 0 and not searchable
    ...matching.map(instance),
    ...(includeNoMatch ? ['hBP09-017', 'hBP09-020', 'hBP03-015', 'hBP09-016'].map(instance) : []),
  ];
  return state;
}

test('hBP09-016 second-player first-turn Collab finds exactly own-deck Hajime Holomem with Baton 1', () => {
  assert.ok(eligibleNumbers.includes('hBP09-015'));
  assert.ok(eligibleNumbers.includes('hBP09-018'));
  assert.ok(eligibleNumbers.includes('hSD05-002'), 'search includes a legal matching starter printing/card number');
  const state = collabFixture();
  const before = structuredClone(state);
  const collabPower = state.players[0].mainDeck[0];
  let result = act(state, { type: 'collab', zone: 'back1' });
  assert.equal(result.players[0].zones.collab.stack.at(-1).number, 'hBP09-016');
  assert.equal(result.players[0].holoPower.at(-1).id, collabPower.id, 'ordinary Collab Holo Power placement resolves before the search');
  assert.equal(result.pendingChoice?.type, 'cardSelection');
  assert.equal(result.pendingChoice.min, 0, 'hidden-deck card-info search permits fail-to-find under Comprehensive Rules 10.7.2.3.5');
  assert.equal(result.pendingChoice.nonEmptyMin, 2, 'when two matching cards are found, a nonempty choice must contain two');
  assert.equal(result.pendingChoice.optional, false, 'the printed ability remains mandatory even though the hidden search can fail to find');
  assert.equal(result.pendingChoice.max, 2);
  assert.deepEqual(new Set(result.pendingChoice.cards.map(card => card.number)), new Set(eligibleNumbers));
  assert.equal(result.pendingChoice.cards.some(card => card.id === collabPower.id), false, 'the ordinary Collab power card is no longer in the deck');
  assert.equal(result.pendingChoice.cards.some(card => card.number === 'hBP09-017' || card.number === 'hBP09-020' || card.number === 'hBP03-015' || card.number === 'hBP09-016'), false, 'same-name cards with Baton 0/2 are excluded');

  const selected = result.pendingChoice.cards.filter(card => ['hBP09-015', 'hBP09-018'].includes(card.number)).map(card => card.id);
  assert.equal(selected.length, 2);
  result = act(result, { type: 'choose', cardIds: selected }, result.pendingChoice.playerIndex);
  assert.equal(result.pendingChoice, null);
  assert.deepEqual(new Set(result.players[0].hand.map(card => card.id)), new Set(selected));
  assert.ok(result.players[0].mainDeck.some(card => card.number === 'hSD05-002'), 'unselected matching starter card remains in the deck');
  assert.ok(result.players[0].mainDeck.some(card => card.number === 'hBP09-018') === false, 'the selected hBP09-018 instance left the deck');
  assert.notDeepEqual(result.players[0].mainDeck.map(card => card.id), before.players[0].mainDeck.slice(1).filter(card => !selected.includes(card.id)).map(card => card.id), 'the remaining main deck is shuffled after the search');
  conserve(before, result);
});

test('hBP09-016 has no card choice when no eligible target exists and still shuffles', () => {
  const state = collabFixture({ matching: [], includeNoMatch: true });
  let randomCalls = 0;
  const result = act(state, { type: 'collab', zone: 'back1' }, 0, cards, () => { randomCalls += 1; return 0.4; });
  assert.equal(result.pendingChoice, null);
  assert.ok(randomCalls > 0, 'the printed shuffle still happens without a selectable match');
  assert.ok(result.players[0].mainDeck.every(card => !eligibleNumbers.includes(card.number)));
  assert.equal(result.players[0].hand.length, 0);
});

test('hBP09-016 may fail to find eligible Hajime cards despite matches and still shuffles', () => {
  const state = collabFixture();
  const matchingIds = state.players[0].mainDeck.filter(card => eligibleNumbers.includes(card.number)).map(card => card.id);
  let randomCalls = 0;
  let result = act(state, { type: 'collab', zone: 'back1' });
  assert.ok(matchingIds.some(id => result.pendingChoice?.cards.some(card => card.id === id)));
  assert.equal(result.pendingChoice?.min, 0);
  assert.equal(result.pendingChoice?.nonEmptyMin, 2);
  assert.equal(result.pendingChoice?.optional, false);
  result = act(result, { type: 'choose', cardIds: [] }, result.pendingChoice.playerIndex, cards, () => { randomCalls += 1; return 0.4; });
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].hand.length, 0, 'no searched card is added after failing to find');
  assert.ok(matchingIds.some(id => result.players[0].mainDeck.some(card => card.id === id)), 'matching cards remain in the deck');
  assert.ok(randomCalls > 0, 'the required shuffle still happens');
});

test('hBP09-016 takes one available match when the main deck contains only one eligible target', () => {
  const state = collabFixture({ matching: ['hSD05-002'], includeNoMatch: false });
  const targetId = state.players[0].mainDeck[1].id;
  let result = act(state, { type: 'collab', zone: 'back1' });
  assert.equal(result.pendingChoice?.min, 0);
  assert.equal(result.pendingChoice?.nonEmptyMin, 1);
  assert.equal(result.pendingChoice?.max, 1);
  assert.deepEqual(result.pendingChoice.cards.map(card => card.number), ['hSD05-002']);
  result = act(result, { type: 'choose', cardIds: [targetId] }, result.pendingChoice.playerIndex);
  assert.ok(result.players[0].hand.some(card => card.id === targetId));
  assert.equal(result.pendingChoice, null);
});

test('hBP09-016 effect does not activate on first player first turn or second-player later turns', () => {
  for (const [firstPlayer, turnsTaken] of [[0, 1], [1, 2]]) {
    const state = collabFixture({ firstPlayer, turnsTaken });
    const result = act(state, { type: 'collab', zone: 'back1' });
    assert.equal(result.pendingChoice, null, `firstPlayer=${firstPlayer}, turnsTaken=${turnsTaken} must not search`);
    assert.equal(result.players[0].zones.collab.stack.at(-1).number, 'hBP09-016', 'the ordinary Collab still resolves');
  }
});

test('website catalog matches official hBP09-016 keyword and vanilla Arts data', () => {
  const card = cards.find(entry => entry.number === 'hBP09-016');
  assert.ok(card);
  assert.deepEqual(new Set(card.variants.map(variant => variant.id)), new Set(['hbp09-hBP09-016_U']));
  assert.equal(card.keyword.effect, '自分が後攻で最初のターンなら、自分のデッキから、バトンタッチに必要な無色が１つの〈轟はじめ〉2枚を公開し、手札に加える。そしてデッキをシャッフルする。');
  assert.equal(card.arts[0].damage, 30);
  assert.deepEqual(card.arts[0].cost, ['無色']);
  assert.equal(card.arts[0].effect, '');
});

test('hBP09-016 vanilla Arts deals 30 and leaves its one Colorless Cheer attached', () => {
  const state = fixture();
  state.turn = 2;
  state.firstPlayer = 1;
  state.activePlayer = 0;
  state.phase = 'performance';
  state.players[0].turnsTaken = 1;
  state.players[0].zones.center = unit('hBP09-016', 1);
  state.players[0].turnEvents = { turn: 2, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  const cheerId = state.players[0].zones.center.cheer[0].id;
  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  assert.equal(result.players[1].zones.center.damage, 30);
  assert.ok(result.players[0].zones.center.cheer.some(card => card.id === cheerId), 'Arts cost is a requirement, not Cheer payment');
});
