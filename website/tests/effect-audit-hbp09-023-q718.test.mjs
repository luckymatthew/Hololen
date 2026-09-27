import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, settle } from './hbp09-fixtures.mjs';

test('Q718 resolves hBP09-023 Gift during the Down process, before the defeated player loses their normal Life', () => {
  const state = fixture();
  state.turn = 3;
  state.activePlayer = 0;
  state.phase = 'performance';
  state.players[0].oshi = instance('hBP07-002');
  const zeta = unit('hBP09-023');
  zeta.cheer = Array.from({ length: 3 }, () => instance('hY01-015'));
  state.players[0].zones.center = zeta;
  state.players[1].zones.center = unit('hBP09-016');
  state.players[1].zones.collab = null;
  state.players[1].zones.back1 = unit('hBP09-064');
  state.players[0].life = Array.from({ length: 4 }, () => instance('hY01-001'));
  state.players[1].life = Array.from({ length: 4 }, () => instance('hY01-001'));
  state.players[0].turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };

  let result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, cards, () => 0.5);

  assert.equal(result.players[1].zones.center.downPending, true, 'the target is still inside its Down process while Zeta Gift resolves');
  assert.deepEqual(result.players[0].turnEvents.dice.map(roll => roll.value), [4, 4]);
  assert.deepEqual(result.players.map(player => player.life.length), [4, 3]);
  assert.deepEqual(result.lifeLosses.map(loss => loss.sourceName), ['hBP09-023'], 'the matching Gift Life loss occurs before normal Down Life loss');
  assert.equal(result.pendingChoice?.type, 'lifeCheerTarget');
  assert.equal(result.pendingChoice?.playerIndex, 1);

  result = settle(result, cards);
  assert.equal(result.players[1].zones.center, null, 'the Down process finishes after its waiting choices');
  assert.deepEqual(result.players.map(player => player.life.length), [4, 2]);
  assert.deepEqual(result.lifeLosses.map(loss => loss.sourceName), ['hBP09-023', '轟一']);
});
