import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act } from './hbp09-fixtures.mjs';

const unrelatedHolomem = cards.find(card => card.group === 'holomem'
  && !['大空スバル', 'ハコス・ベールズ', 'AZKi', '風真いろは'].includes(card.jpName));
const azki1st = cards.find(card => card.group === 'holomem' && card.jpName === 'AZKi' && card.stage === '1st');
const iroha1st = cards.find(card => card.group === 'holomem' && card.jpName === '風真いろは' && card.stage === '1st');
assert.ok(unrelatedHolomem && azki1st && iroha1st);

function countedRandom() {
  let calls = 0;
  return { next: () => { calls += 1; return 0.37; }, calls: () => calls };
}

function deckWith(numbers) {
  const deck = numbers.map(instance);
  while (deck.length < 50) deck.push(instance(unrelatedHolomem.number));
  return deck;
}

function chooseCard(state, number, random) {
  const pending = state.pendingChoice;
  assert.equal(pending?.type, 'cardSelection');
  const card = pending.cards.find(candidate => candidate.number === number
    && pending.selectableIds.includes(candidate.id));
  assert.ok(card, `expected selectable ${number}`);
  return act(state, { type: 'choose', cardIds: [card.id] }, pending.playerIndex, cards, random.next);
}

function chooseZone(state, zone, random) {
  const pending = state.pendingChoice;
  assert.equal(pending?.type, 'stageTarget');
  return act(state, { type: 'choose', zone }, pending.playerIndex, cards, random.next);
}

function bloom048State() {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'main';
  const player = state.players[0];
  player.oshi = instance('hBP09-001');
  player.zones = { center: unit('hBP09-047'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  player.zones.center.enteredTurn = 1;
  player.zones.center.bloomedTurn = 0;
  player.turnsTaken = 3;
  player.turnEvents = { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  player.hand = [instance('hBP09-048')];
  player.mainDeck = deckWith(['hBP09-010', 'hBP09-048']);
  player.namedUsageTurns = {};
  state.players[1].zones = { center: unit('hBP09-041'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  return state;
}

function support091State() {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'main';
  const player = state.players[0];
  player.oshi = instance('hBP07-006');
  player.zones = { center: unit('hBP09-051'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  player.turnsTaken = 3;
  player.turnEvents = { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  player.hand = [instance('hBP09-091')];
  player.mainDeck = deckWith([azki1st.number, iroha1st.number]);
  player.namedUsageTurns = {};
  state.knockouts = [{ turn: 7, ownerIndex: 0, sourcePlayerIndex: 1 }];
  state.players[1].zones = { center: unit('hBP09-041'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  return state;
}

test('hBP09-048 finishes both printed searches before its single deck shuffle', () => {
  const random = countedRandom();
  let state = bloom048State();
  state = act(state, { type: 'play', cardId: state.players[0].hand[0].id }, 0, cards, random.next);
  assert.equal(state.pendingChoice?.type, 'bloom');
  state = act(state, { type: 'choose', zone: 'center' }, 0, cards, random.next);
  assert.equal(state.pendingChoice?.type, 'cardSelection');

  state = chooseCard(state, 'hBP09-010', random);
  assert.equal(random.calls(), 0, 'the deck is not shuffled between the Subaru and Baelz searches');
  state = chooseCard(state, 'hBP09-048', random);

  assert.equal(random.calls(), 47, 'one Fisher-Yates shuffle of the 48 cards left in the deck');
  assert.equal(state.pendingChoice, null);
  assert.equal(state.players[0].mainDeck.length, 48);
});

test('hBP09-091 deploys both searched Holomen before its single deck shuffle', () => {
  const random = countedRandom();
  let state = support091State();
  state = act(state, { type: 'play', cardId: state.players[0].hand[0].id }, 0, cards, random.next);
  assert.equal(state.pendingChoice?.type, 'cardSelection');

  state = chooseCard(state, azki1st.number, random);
  state = chooseZone(state, 'back1', random);
  assert.equal(random.calls(), 0, 'the deck is not shuffled between the AZKi and Iroha searches');
  state = chooseCard(state, iroha1st.number, random);
  state = chooseZone(state, 'back2', random);

  assert.equal(random.calls(), 47, 'one Fisher-Yates shuffle of the 48 cards left in the deck');
  assert.equal(state.pendingChoice, null);
  assert.equal(state.players[0].zones.back1.stack.at(-1).number, azki1st.number);
  assert.equal(state.players[0].zones.back2.stack.at(-1).number, iroha1st.number);
  assert.equal(state.players[0].mainDeck.length, 48);
});
