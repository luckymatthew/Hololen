import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, conserve } from './hbp09-fixtures.mjs';

test('Q719 hBP09-037 returns the selected FLOW GLOW stage stack to hand and archives attached cards', () => {
  const state = fixture();
  state.turn = 3;
  state.activePlayer = 0;
  state.phase = 'performance';
  state.players[0].oshi = instance('hSD10-001');
  const attacker = unit('hBP09-037');
  attacker.cheer = [instance('hY02-013'), instance('hY02-013'), instance('hY01-015')];
  state.players[0].zones.center = attacker;

  const selected = unit('hBP09-066');
  selected.stack = [instance('hBP09-064'), selected.stack[0]];
  selected.cheer = [instance('hY01-015')];
  selected.attachments = [instance('hBP09-109')];
  state.players[0].zones.back1 = selected;
  const ineligibleHolomem = unit('hBP01-009');
  state.players[0].zones.back2 = ineligibleHolomem;
  state.players[1].zones.center = unit('hBP09-016');
  state.players[1].zones.collab = null;
  state.players[0].turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  const stackedHolomemIds = selected.stack.map(card => card.id);
  const attachedIds = [...selected.cheer, ...selected.attachments].map(card => card.id);
  const allCardsBefore = state;

  let result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, cards, () => 0.25);
  assert.equal(result.players[1].zones.center.downPending, true, 'Zeta resolves its Gift while the target Down is pending');
  assert.equal(result.pendingChoice?.type, 'stageTarget');
  assert.equal(result.pendingChoice?.effect, 'hbp09');
  assert.deepEqual(result.pendingChoice?.options, ['back1']);

  result = act(result, { type: 'choose', zone: 'back1' }, result.pendingChoice.playerIndex, cards, () => 0.25);

  assert.equal(result.players[0].zones.back1, null);
  assert.deepEqual(result.players[0].hand.slice(-stackedHolomemIds.length).map(card => card.id), stackedHolomemIds);
  assert.ok(attachedIds.every(id => result.players[0].archive.some(card => card.id === id)), 'Q719 requires every attached Cheer and attachment to go to Archive');
  assert.equal(result.pendingChoice?.type, 'lifeCheerTarget', 'ordinary Down Life processing continues after Fantastic Driver');
  assert.equal(result.pendingChoice?.playerIndex, 1);
  const lifeCheer = result.pendingChoice.cheerCard;
  assert.ok(lifeCheer?.id, 'the revealed Down Life remains represented while its target is pending');
  result = act(result, { type: 'choose', zone: 'back1' }, result.pendingChoice.playerIndex, cards, () => 0.25);
  assert.equal(result.pendingChoice, null, 'the normal Down sequence finishes after the Life Cheer choice');
  assert.ok(result.players[1].zones.back1.cheer.some(card => card.id === lifeCheer.id), 'the pending Life Cheer is attached to its chosen Holomem');
  assert.deepEqual(result.players[0].zones.back2.stack.map(card => card.id), ineligibleHolomem.stack.map(card => card.id), 'a Back Holomem without #FLOW GLOW is not returned');
  conserve(allCardsBefore, result);
});
