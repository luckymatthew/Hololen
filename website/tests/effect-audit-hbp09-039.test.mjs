import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, answer } from './hbp09-fixtures.mjs';

const officialTools = ['hBP09-106', 'hBP09-107', 'hBP09-108'];

function kaelaFixture({ firstPlayer = 1, turnsTaken = 1, tools = officialTools } = {}) {
  const state = fixture(6, 64);
  state.turn = 1;
  state.activePlayer = 0;
  state.firstPlayer = firstPlayer;
  state.players[0].turnsTaken = turnsTaken;
  state.players[1].turnsTaken = 1;
  state.players[0].zones.back1 = unit('hBP09-039');
  state.players[0].mainDeck = [instance('hBP09-051'), ...tools.map(instance), instance('hBP09-051')];
  return state;
}

function collab(state, random = () => 0.4) {
  return act(state, { type: 'collab', zone: 'back1' }, 0, cards, random);
}

test('hBP09-039 official identity and Japanese Workaholic/Arts text match the production catalog', () => {
  const card = cards.find(entry => entry.number === 'hBP09-039');
  assert.ok(card);
  assert.equal(card.jpName, 'カエラ・コヴァルスキア');
  assert.equal(card.stage, 'Debut');
  assert.equal(card.hp, 130);
  assert.equal(card.keyword.type, 'collab');
  assert.equal(card.keyword.effect, '自分が後攻で最初のターンなら、自分のデッキから、ツール2枚を公開し、手札に加える。そしてデッキをシャッフルする。');
  assert.equal(card.arts[0].damage, 20);
  assert.deepEqual(card.arts[0].cost, ['無色']);
});

test('second player first-turn Collab keeps a mandatory effect with a 0-to-2 hidden-deck search', () => {
  const state = collab(kaelaFixture());
  const choice = state.pendingChoice;
  assert.equal(choice?.type, 'cardSelection');
  assert.equal(choice?.min, 0, 'the hidden-deck card-info search permits fail-to-find under Comprehensive Rules 10.7.2.3.5');
  assert.equal(choice?.nonEmptyMin, 2, 'Workaholic requires two Tools when taking a nonempty result');
  assert.equal(choice?.optional, false, 'the Collab Effect itself is still mandatory');
  assert.equal(choice?.max, 2);
  assert.deepEqual(new Set(choice.cards.map(card => card.number)), new Set(officialTools));
});

test('Workaholic may fail to find Tools despite matches and still performs its written shuffle', () => {
  const state = kaelaFixture();
  const matchingIds = state.players[0].mainDeck.filter(card => officialTools.includes(card.number)).map(card => card.id);
  let randomCalls = 0;
  let result = collab(state);
  assert.equal(result.pendingChoice?.min, 0);
  assert.equal(result.pendingChoice?.nonEmptyMin, 2);
  assert.equal(result.pendingChoice?.optional, false);
  result = act(result, { type: 'choose', cardIds: [] }, result.pendingChoice.playerIndex, cards, () => { randomCalls += 1; return 0.4; });

  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].hand.length, 0);
  assert.ok(matchingIds.some(id => result.players[0].mainDeck.some(card => card.id === id)), 'the matching Tools remain in the deck');
  assert.ok(randomCalls > 0, 'the printed shuffle occurs after failing to find');
});

test('choosing a nonempty Workaholic result must satisfy the printed two-Tool count', () => {
  const initial = kaelaFixture();
  const originalHandSize = initial.players[0].hand.length;
  const originalDeckSize = initial.players[0].mainDeck.length;
  const collabState = collab(initial);
  const selected = collabState.pendingChoice.cards.slice(0, 2);
  assert.equal(collabState.pendingChoice.nonEmptyMin, 2);
  assert.throws(() => act(collabState, { type: 'choose', cardIds: [selected[0].id] }, 0, cards, () => 0.4), /empty|count|選擇/u);
  let randomCalls = 0;
  const result = act(collabState, { type: 'choose', cardIds: selected.map(card => card.id) }, 0, cards, () => { randomCalls += 1; return 0.4; });

  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].hand.length, originalHandSize + 2);
  assert.ok(selected.every(card => result.players[0].hand.some(item => item.id === card.id)));
  assert.equal(result.players[0].mainDeck.length, originalDeckSize - 3, 'ordinary Collab moves one card to Holo Power, and the two selected Tools leave the deck');
  assert.equal(result.players[0].holoPower.length, initial.players[0].holoPower.length + 1);
  assert.ok(randomCalls > 0, 'the printed post-search shuffle is performed');
  assert.ok(result.log.some(entry => JSON.stringify(entry).includes(selected[0].id)), 'the selected Tools are publicly revealed in the game record');
});

test('selecting two Tools adds exactly both selected cards to hand and removes them from the deck', () => {
  const state = kaelaFixture();
  const handSize = state.players[0].hand.length;
  const originalDeckSize = state.players[0].mainDeck.length;
  const collabState = collab(state);
  const selected = collabState.pendingChoice.cards.slice(0, 2);
  const result = answer(collabState, { cardIds: selected.map(card => card.id) });

  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].hand.length, handSize + 2);
  assert.ok(selected.every(card => result.players[0].hand.some(item => item.id === card.id)));
  assert.equal(result.players[0].mainDeck.length, originalDeckSize - 3);
});

test('when there are no Tools in the deck, Workaholic takes none but still shuffles after Collab', () => {
  const state = kaelaFixture({ tools: [] });
  state.players[0].mainDeck = Array.from({ length: 6 }, () => instance('hBP09-051'));
  const handSize = state.players[0].hand.length;
  let randomCalls = 0;
  const result = collab(state, () => { randomCalls += 1; return 0.4; });

  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].hand.length, handSize);
  assert.equal(result.players[0].mainDeck.length, 5, 'only the ordinary Collab Holo Power card and no search result leave the deck');
  assert.equal(result.players[0].holoPower.length, state.players[0].holoPower.length + 1);
  assert.ok(randomCalls > 0, 'the explicit shuffle still occurs when no Tool is found');
});

test('Workaholic does not trigger on the first player first turn or on a later second-player turn', () => {
  for (const config of [{ firstPlayer: 0, turnsTaken: 1 }, { firstPlayer: 1, turnsTaken: 2 }]) {
    const state = kaelaFixture({ ...config, tools: officialTools });
    const handIds = state.players[0].hand.map(card => card.id);
    const deckSize = state.players[0].mainDeck.length;
    const result = collab(state);
    assert.equal(result.pendingChoice, null);
    assert.deepEqual(result.players[0].hand.map(card => card.id), handIds);
    assert.equal(result.players[0].mainDeck.length, deckSize - 1);
  }
});

test('hBP09-039 colorless 20 Arts rests Kaela and keeps its cost Cheer attached', () => {
  const state = fixture(6, 64);
  state.phase = 'performance';
  state.players[0].zones.collab = unit('hBP09-039', 1);
  state.players[0].zones.collab.cheer[0] = instance('hY01-015');
  const cheerIds = state.players[0].zones.collab.cheer.map(card => card.id);
  const result = act(state, { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' });

  assert.equal(result.players[1].zones.center.damage, 20);
  assert.equal(result.players[0].zones.collab.rested, true);
  assert.deepEqual(result.players[0].zones.collab.cheer.map(card => card.id), cheerIds);
});
