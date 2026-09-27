import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, conserve } from './hbp09-fixtures.mjs';

const DECK_TOP = ['hBP09-016', 'hBP09-017', 'hBP09-020'];

function replaceStage(player, zones) {
  for (const old of Object.values(player.zones)) {
    if (old) player.archive.push(...old.stack, ...old.cheer, ...old.attachments);
  }
  player.zones = { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null, ...zones };
}

function setDeck(player, numbers) {
  player.archive.push(...player.mainDeck);
  player.mainDeck = numbers.map(instance);
}

function bloomFixture({ targetZone = 'center', deckCount = 3 } = {}) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'main';
  const player = state.players[0];
  player.turnsTaken = 3;
  replaceStage(player, {
    center: unit(targetZone === 'center' ? 'hBP09-015' : 'hBP09-064'),
    ...(targetZone === 'back1' ? { back1: unit('hBP09-015') } : {}),
  });
  for (const stageUnit of Object.values(player.zones)) {
    if (stageUnit) {
      stageUnit.enteredTurn = 1;
      stageUnit.bloomedTurn = 0;
    }
  }
  player.hand.push(instance('hBP09-018'));
  setDeck(player, DECK_TOP.slice(0, deckCount));
  player.turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  player.namedUsageTurns = {};
  return state;
}

function resolveBloom(state, zone) {
  const card = state.players[0].hand.find(candidate => candidate.number === 'hBP09-018');
  assert.ok(card, 'the official 1st hBP09-018 must be in hand');
  let next = act(state, { type: 'play', cardId: card.id });
  assert.equal(next.pendingChoice?.type, 'bloom', 'play must enter the real Bloom target choice');
  assert.ok(next.pendingChoice.options.includes(zone), 'the target is a legal same-name Debut Holomem');
  next = JSON.parse(JSON.stringify(next)); // model an offline save/reload at the pending Bloom target
  return act(next, { type: 'choose', zone }, next.pendingChoice.playerIndex);
}

function artsFixture(sourceZone) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'performance';
  const player = state.players[0];
  replaceStage(player, {
    center: unit(sourceZone === 'center' ? 'hBP09-018' : 'hBP09-064', 1),
    ...(sourceZone === 'collab' ? { collab: unit('hBP09-018', 1) } : {}),
  });
  player.turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  if (sourceZone === 'collab') {
    player.zones.collab.collabbedTurn = state.turn;
    player.collabTurn = state.turn;
  }
  return state;
}

test('hBP09-018 Center Bloom draws exactly the top two cards and survives a pending-choice save/reload', () => {
  const state = bloomFixture({ targetZone: 'center' });
  const before = structuredClone(state);
  const firstTwo = state.players[0].mainDeck.slice(0, 2).map(card => card.id);
  const result = resolveBloom(state, 'center');
  assert.deepEqual(result.players[0].hand.map(card => card.id), firstTwo, 'each draw moves the next main-deck instance into hand in order');
  assert.deepEqual(result.players[0].mainDeck.map(card => card.id), before.players[0].mainDeck.slice(2).map(card => card.id));
  assert.equal(result.players[0].zones.center.stack.at(-1).number, 'hBP09-018');
  assert.equal(result.players[0].turnEvents.bloomCount, 1, 'resuming the Bloom target choice resolves the effect exactly once');
  conserve(before, result);
});

test('hBP09-018 Bloom into Back does not draw because its Bloom Effect is Center-only', () => {
  const state = bloomFixture({ targetZone: 'back1' });
  const before = structuredClone(state);
  const result = resolveBloom(state, 'back1');
  assert.deepEqual(result.players[0].mainDeck.map(card => card.id), before.players[0].mainDeck.map(card => card.id));
  assert.deepEqual(result.players[0].hand, []);
  assert.equal(result.players[0].zones.back1.stack.at(-1).number, 'hBP09-018');
  assert.equal(result.status, 'playing');
  conserve(before, result);
});

test('hBP09-018 required draw-two repeats only for cards available and does not lose on an effect draw', () => {
  for (const deckCount of [1, 0]) {
    const state = bloomFixture({ targetZone: 'center', deckCount });
    const before = structuredClone(state);
    const expected = state.players[0].mainDeck.map(card => card.id);
    const result = resolveBloom(state, 'center');
    assert.deepEqual(result.players[0].hand.map(card => card.id), expected, 'draw up to the cards actually in the deck');
    assert.deepEqual(result.players[0].mainDeck, []);
    assert.equal(result.status, 'playing', 'an effect draw is not the turn-draw loss condition');
    conserve(before, result);
  }
});

test('hBP09-018 Arts deals 30 from Center and 50 from Collab with the printed one-Colorless requirement', () => {
  for (const [sourceZone, expectedDamage] of [['center', 30], ['collab', 50]]) {
    const state = artsFixture(sourceZone);
    const before = structuredClone(state);
    const cheerId = state.players[0].zones[sourceZone].cheer[0].id;
    const result = act(state, { type: 'attack', sourceZone, artIndex: 0, targetZone: 'center' });
    assert.equal(result.players[1].zones.center.damage, expectedDamage, sourceZone + ' Arts damage');
    assert.ok(result.players[0].zones[sourceZone].cheer.some(card => card.id === cheerId), 'the Colorless Cheer satisfies Arts but is not archived');
    assert.equal(result.players[0].turnEvents.arts.filter(number => number === 'hBP09-018').length, 1);
    conserve(before, result);
  }
});

test('hBP09-018 cannot use Arts from Back and the rejected command leaves the state unchanged', () => {
  const state = fixture();
  state.turn = 8;
  state.phase = 'performance';
  state.activePlayer = 0;
  const player = state.players[0];
  replaceStage(player, { center: unit('hBP09-064'), back1: unit('hBP09-018', 1) });
  const snapshot = JSON.stringify(state);
  assert.throws(() => act(state, { type: 'attack', sourceZone: 'back1', artIndex: 0, targetZone: 'center' }));
  assert.equal(JSON.stringify(state), snapshot);
});

test('website catalog matches official hBP09-018 C/S Japanese text, variants, Arts cost and base power', () => {
  const card = cards.find(entry => entry.number === 'hBP09-018');
  assert.ok(card);
  assert.deepEqual(new Set(card.variants.map(variant => variant.id)), new Set(['hbp09-hBP09-018_C', 'hbp09-hBP09-018_S']));
  assert.equal(card.jpName, '轟はじめ');
  assert.equal(card.stage, '1st');
  assert.equal(card.keyword.name, 'はじめのジャケット');
  assert.equal(card.keyword.effect, '[センターポジション限定]自分のデッキを2枚引く。');
  assert.equal(card.arts[0].name, 'おちょなびたふくそー');
  assert.equal(card.arts[0].damage, 30);
  assert.deepEqual(card.arts[0].cost, ['無色']);
  assert.equal(card.arts[0].effect, '[コラボポジション限定]このアーツ+20。');
});
