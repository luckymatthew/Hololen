import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, instance, unit, act, attack, conserve } from './hbp09-fixtures.mjs';

function bloomFixture({ oshi = 1, opponentPower = 2 } = {}) {
  const state = fixture(oshi, 64);
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'main';
  const player = state.players[0];
  player.turnEvents = { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  player.namedUsageTurns = {};
  for (const zone of ['center', 'back1', 'back2']) {
    player.zones[zone] = unit('hBP09-009');
    player.zones[zone].enteredTurn = 1;
  }
  player.hand.push(instance('hBP09-012'), instance('hBP09-012'), instance('hBP09-012'));
  state.players[1].holoPower = state.players[1].holoPower.slice(0, opponentPower);
  return state;
}

function bloom(state, zone) {
  const card = state.players[0].hand.find(candidate => candidate.number === 'hBP09-012');
  assert.ok(card, 'hBP09-012 must be in hand');
  const queued = act(state, { type: 'play', cardId: card.id });
  assert.equal(queued.pendingChoice?.type, 'bloom');
  assert.ok(queued.pendingChoice.options.includes(zone));
  return act(queued, { type: 'choose', zone });
}

function artsFixture(knockouts = []) {
  const state = fixture(1, 64);
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'performance';
  const subaru = unit('hBP09-009');
  subaru.stack.push(instance('hBP09-012'));
  subaru.enteredTurn = 1;
  subaru.bloomedTurn = 7;
  subaru.cheer = [instance('hY01-001'), instance('hY01-001'), instance('hY01-001')];
  state.players[0].zones.center = subaru;
  state.players[0].turnEvents = { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  state.knockouts = knockouts;
  return state;
}

test('hBP09-012 Bloom Effect gains only the top deck card when Subaru Oshi and at least two opposing Holo Power are present', () => {
  const state = bloomFixture();
  const expected = state.players[0].mainDeck[0];
  const before = structuredClone(state);
  const settled = bloom(state, 'center');
  assert.equal(settled.players[0].holoPower.at(-1).id, expected.id);
  assert.equal(settled.players[0].mainDeck.length, before.players[0].mainDeck.length - 1);
  assert.equal(settled.players[0].holoPower.length, before.players[0].holoPower.length + 1);
  conserve(before, settled);
});

test('hBP09-012 Bloom Effect is once per player per turn across copies and resets on the next turn', () => {
  let state = bloomFixture();
  const initialPower = state.players[0].holoPower.length;
  state = bloom(state, 'center');
  assert.equal(state.players[0].holoPower.length, initialPower + 1);
  const onceKey = state.players[0].namedUsageTurns['hbp09:BIG3-side-S'];
  assert.equal(onceKey, state.turn);

  state = bloom(state, 'back1');
  assert.equal(state.players[0].holoPower.length, initialPower + 1, 'a second copy cannot repeat the named Bloom Effect this turn');

  state.turn += 1;
  state.players[0].turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  const expected = state.players[0].mainDeck[0];
  state = bloom(state, 'back2');
  assert.equal(state.players[0].holoPower.at(-1).id, expected.id);
  assert.equal(state.players[0].holoPower.length, initialPower + 2);
});

test('hBP09-012 Bloom Effect does not gain Holo Power without Subaru Oshi or two opposing Holo Power', () => {
  for (const config of [{ oshi: 6, opponentPower: 2 }, { oshi: 1, opponentPower: 1 }]) {
    const state = bloomFixture(config);
    const before = structuredClone(state);
    const settled = bloom(state, 'center');
    assert.equal(settled.players[0].holoPower.length, before.players[0].holoPower.length);
    assert.equal(settled.players[0].mainDeck.length, before.players[0].mainDeck.length);
    assert.equal(settled.players[0].namedUsageTurns['hbp09:BIG3-side-S'], undefined, 'a failed condition must not spend the once-per-turn allowance');
    conserve(before, settled);
  }
});

test('hBP09-012 Arts gains exactly 50 for any own Holomem Down during the preceding opponent turn', () => {
  const downDuringOpponentTurn = artsFixture([
    { turn: 7, ownerIndex: 0, sourcePlayerIndex: 0, sourceName: 'opponent-turn triggered effect' },
  ]);
  const before = structuredClone(downDuringOpponentTurn);
  const settled = attack(downDuringOpponentTurn, 0, 'center');
  assert.equal(settled.players[1].zones.center.damage, 130, 'the clause describes when the owned Holomem went Down, not who caused that Down');
  conserve(before, settled);
});

test('hBP09-012 Arts does not gain 50 for an opponent Down or an own Down outside the immediately preceding opponent turn', () => {
  for (const knockouts of [
    [{ turn: 7, ownerIndex: 1, sourcePlayerIndex: 0 }],
    [{ turn: 6, ownerIndex: 0, sourcePlayerIndex: 1 }],
  ]) {
    const state = artsFixture(knockouts);
    const settled = attack(state, 0, 'center');
    assert.equal(settled.players[1].zones.center.damage, 80);
  }
});
