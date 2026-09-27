import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, answer, conserve } from './hbp09-fixtures.mjs';

const card048 = cards.find(card => card.number === 'hBP09-048');
const targetNumbers = ['hBP09-010', 'hBP09-048'];
const searchedNames = new Set(['大空スバル', 'ハコス・ベールズ']);
const fillerNumbers = cards.filter(card => card.group === 'holomem' && !searchedNames.has(card.jpName))
  .slice(0, 14).map(card => card.number);

function deckWithTargets(numbers) {
  const deck = numbers.map(instance);
  for (const number of fillerNumbers) {
    for (let count = 0; count < 4 && deck.length < 50; count++) deck.push(instance(number));
  }
  assert.equal(deck.length, 50, 'test deck is a legal 50-card main deck');
  assert.ok(numbers.every(number => deck.some(card => card.number === number)));
  return deck;
}

function bloomState({ oshi = 'hBP09-001', targets = targetNumbers } = {}) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'main';
  const player = state.players[0];
  player.oshi = instance(oshi);
  player.zones = { center: unit('hBP09-047'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  player.zones.center.enteredTurn = 1;
  player.zones.center.bloomedTurn = 0;
  player.hand = [instance('hBP09-048')];
  player.mainDeck = deckWithTargets(targets);
  player.turnsTaken = 3;
  player.turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  player.namedUsageTurns = {};
  state.players[1].zones = { center: unit('hBP09-041'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  return state;
}

function bloom048(state) {
  const card = state.players[0].hand.find(entry => entry.number === 'hBP09-048');
  assert.ok(card);
  let next = act(state, { type: 'play', cardId: card.id });
  assert.equal(next.pendingChoice?.type, 'bloom');
  next = answer(next, { zone: 'center' });
  assert.equal(next.players[0].zones.center.stack.at(-1).number, 'hBP09-048');
  return next;
}

function selectNumber(state, number) {
  const pending = state.pendingChoice;
  assert.equal(pending?.type, 'cardSelection');
  const card = pending.cards.find(entry => entry.number === number && pending.selectableIds.includes(entry.id));
  assert.ok(card, `expected selectable ${number}`);
  return answer(state, { cardIds: [card.id] });
}

function artState({ collab = true } = {}) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'performance';
  state.players[0].zones = { center: unit('hBP09-048', 1), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  state.players[0].turnsTaken = 3;
  state.players[0].turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  state.players[1].zones = { center: unit('hBP09-041'), collab: collab ? unit('hBP09-042') : null, back1: unit('hBP09-043'), back2: null, back3: null, back4: null, back5: null };
  return state;
}

test('hBP09-048 U/S identity, stage, stats, Bloom condition, Arts cost and exact Japanese text match the official card list', () => {
  assert.ok(card048);
  assert.equal(card048.jpName, 'ハコス・ベールズ');
  assert.equal(card048.stage, '1st');
  assert.equal(card048.hp, 160);
  assert.deepEqual(card048.colors, ['紅']);
  assert.equal(card048.baton, 1);
  assert.deepEqual(new Set(card048.variants.map(variant => variant.rarity)), new Set(['U', 'S']));
  assert.equal(card048.keyword.type, 'bloom');
  assert.equal(card048.keyword.name, 'CHAOTIC INVITATION');
  assert.equal(card048.keyword.effect, '自分の推しホロメンが〈大空スバル〉なら、自分のデッキから、1st[〈大空スバル〉と〈ハコス・ベールズ〉]1枚ずつを公開し、手札に加える。そしてデッキをシャッフルする。');
  assert.deepEqual(card048.arts[0].cost, ['無色']);
  assert.equal(card048.arts[0].damage, 30);
  assert.equal(card048.arts[0].effect, 'サイコロを1回振る。奇数なら、相手のコラボホロメンに特殊ダメージ20を与える。');
});

test('CHAOTIC INVITATION on Subaru Oshi adds one legal 1st Subaru and one 1st Baelz, then finishes the search', () => {
  const state = bloomState();
  const before = structuredClone(state);
  let result = bloom048(state);
  const revealed = [];
  for (const number of targetNumbers) {
    assert.equal(result.pendingChoice?.type, 'cardSelection');
    assert.equal(result.pendingChoice.min, 0, 'hidden-deck searches allow fail-to-find');
    assert.equal(result.pendingChoice.nonEmptyMin, 1);
    assert.equal(result.pendingChoice.max, 1);
    assert.equal(result.pendingChoice.optional, false, 'the Bloom ability itself is not an optional activation');
    revealed.push(result.pendingChoice.cards.find(card => card.number === number)?.id);
    result = selectNumber(result, number);
  }
  assert.equal(result.pendingChoice, null);
  assert.deepEqual(result.players[0].hand.map(card => card.number).sort(), [...targetNumbers].sort());
  assert.equal(result.players[0].mainDeck.length, before.players[0].mainDeck.length - 2);
  assert.ok(revealed.every(Boolean));
  conserve(before, result);
});

test('CHAOTIC INVITATION can fail to find one hidden-deck target and still completes the other search', () => {
  const state = bloomState();
  const before = structuredClone(state);
  let result = bloom048(state);
  assert.equal(result.pendingChoice?.type, 'cardSelection');
  assert.equal(result.pendingChoice.min, 0);
  assert.equal(result.pendingChoice.nonEmptyMin, 1);
  result = answer(result, { cardIds: [] });
  assert.equal(result.pendingChoice?.type, 'cardSelection', 'the second printed target is still searched');
  result = selectNumber(result, 'hBP09-048');
  assert.equal(result.pendingChoice, null);
  assert.deepEqual(result.players[0].hand.map(card => card.number), ['hBP09-048']);
  assert.equal(result.players[0].mainDeck.length, before.players[0].mainDeck.length - 1);
  assert.ok(result.players[0].mainDeck.some(card => card.number === 'hBP09-010'), 'the declined Subaru remains in the deck');
  conserve(before, result);
});

test('CHAOTIC INVITATION does not search or shuffle when the own Oshi is not Subaru', () => {
  const state = bloomState({ oshi: 'hBP09-006' });
  const beforeDeck = state.players[0].mainDeck.map(card => card.id);
  const result = bloom048(state);
  assert.equal(result.pendingChoice, null);
  assert.deepEqual(result.players[0].hand, []);
  assert.deepEqual(result.players[0].mainDeck.map(card => card.id), beforeDeck);
});

test('Boku to Tanoshimou yo rolls all six outcomes; only odd results add 20 Special damage to opposing Collab', () => {
  for (let die = 1; die <= 6; die++) {
    const state = artState();
    const before = structuredClone(state);
    const cheerId = state.players[0].zones.center.cheer[0].id;
    const random = () => (die - 1) / 6;
    const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, cards, random);
    assert.equal(result.players[1].zones.center.damage, 30, `die ${die}: base Arts damage`);
    assert.equal(result.players[1].zones.collab.damage, die % 2 ? 20 : 0, `die ${die}: conditional Special damage`);
    assert.equal(result.players[1].zones.back1.damage, 0, `die ${die}: no other position is hit`);
    assert.equal(result.players[0].zones.center.rested, true, `die ${die}: attacker rests`);
    assert.deepEqual(result.players[0].zones.center.cheer.map(card => card.id), [cheerId], `die ${die}: paid Cheer remains attached`);
    assert.equal(result.players[0].turnEvents.dice.at(-1).value, die);
    assert.equal(result.pendingChoice, null);
    conserve(before, result);
  }
});

test('odd die still resolves the printed 30 Arts when there is no opposing Collab Holomem', () => {
  const state = artState({ collab: false });
  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, cards, () => 0);
  assert.equal(result.players[1].zones.center.damage, 30);
  assert.equal(result.players[1].zones.collab, null);
  assert.equal(result.pendingChoice, null);
});

test('odd die applies Special damage to the Collab target independently of the ordinary Arts target', () => {
  const state = artState();
  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'collab' }, 0, cards, () => 0.4);
  assert.equal(result.players[1].zones.collab.damage, 50, '30 Arts damage plus 20 Special damage');
  assert.equal(result.players[1].zones.center.damage, 0);
  assert.equal(result.players[0].zones.center.rested, true);
});
