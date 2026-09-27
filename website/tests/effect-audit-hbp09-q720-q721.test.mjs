import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act } from './hbp09-fixtures.mjs';

test('Q720/Q721 Kaela attaches the archived Tool during Arts, triggers Oshi draw, and boosts that Arts', () => {
  const state = fixture();
  state.turn = 7;
  state.activePlayer = 0;
  state.phase = 'performance';
  state.players[0].oshi = instance('hBP09-004');
  const kaela = unit('hBP09-042');
  kaela.cheer = [instance('hY03-001'), instance('hY03-002')];
  state.players[0].zones.center = kaela;
  const sword = instance('hBP09-107');
  state.players[0].archive.push(sword);
  state.players[1].zones.center = unit('hBP09-042');
  state.players[1].zones.collab = null;
  const deckBefore = state.players[0].mainDeck.length;
  const targetDamageBefore = state.players[1].zones.center.damage;

  let result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, cards, () => 0.25);
  assert.equal(result.pendingChoice?.type, 'cardSelection', 'the Arts must resolve its optional Archive Tool selection');
  assert.equal(result.pendingChoice?.playerIndex, 0);
  assert.deepEqual(result.pendingChoice?.selectableIds, [sword.id]);
  result = act(result, { type: 'choose', cardIds: [sword.id] }, 0, cards, () => 0.25);

  assert.ok(result.players[0].zones.center.attachments.some(card => card.id === sword.id), 'hBP09-107 is attached to Kaela');
  assert.ok(!result.players[0].archive.some(card => card.id === sword.id));
  assert.equal(result.players[0].mainDeck.length, deckBefore - 2, 'Q720 draws two cards from TO THE FORGE NOW');
  assert.equal(result.players[1].zones.center.damage - targetDamageBefore, 110, 'Q721 applies the newly attached Tool +40 to this 70-damage Arts');
  assert.equal(result.pendingChoice, null);
});

test('Q721 does not double-count a Kaela Tool already attached before Arts', () => {
  const state = fixture();
  state.turn = 7;
  state.activePlayer = 0;
  state.phase = 'performance';
  state.players[0].zones.center = unit('hBP09-042');
  state.players[0].zones.center.cheer = [instance('hY03-001'), instance('hY03-002')];
  state.players[0].zones.center.attachments.push(instance('hBP09-107'));
  state.players[1].zones.center = unit('hBP09-042');
  state.players[1].zones.collab = null;

  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, cards, () => 0.25);
  assert.equal(result.players[1].zones.center.damage, 110, 'the pre-existing Tool contributes +40 exactly once');
});
