import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, unit, instance, act } from './hbp09-fixtures.mjs';

const purpleCards = cards.map(card => card.number === 'TEST-TARGET' ? { ...card, colors: ['紫'] } : card);

function attackState({ subaruZones = [], opponentSubaru = false, purpleTarget = false } = {}) {
  const state = fixture();
  state.turn = 3;
  state.activePlayer = 0;
  state.phase = 'performance';
  state.players[0].turnEvents = { turn: 3, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  state.players[0].zones.center = unit('hBP09-050', 3);
  for (const zone of subaruZones) state.players[0].zones[zone] = unit('hBP04-067');
  if (opponentSubaru) state.players[1].zones.back1 = unit('hBP04-067');
  state.players[1].zones.center = unit('TEST-TARGET');
  return { state, customCards: purpleTarget ? purpleCards : cards };
}

function useArt({ state, customCards, sourceZone = 'center' }) {
  return act(state, { type: 'attack', sourceZone, artIndex: 0, targetZone: 'center' }, 0, customCards);
}

test('hBP09-050 Art adds 20 damage for each own Subaru across Collab and Back, without counting the opponent stage', () => {
  const { state, customCards } = attackState({ subaruZones: ['collab'], opponentSubaru: true });
  const result = useArt({ state, customCards });
  assert.equal(result.players[1].zones.center.damage, 120);
  assert.match(result.log.find(entry => entry.message.includes('ネズミの大捕り物'))?.message, /造成 120 傷害/u);
});

test('hBP09-050 Art starts at 100 damage when no own Subaru is on stage', () => {
  const { state, customCards } = attackState({ opponentSubaru: true });
  const result = useArt({ state, customCards });
  assert.equal(result.players[1].zones.center.damage, 100, 'the opponent\'s Subaru does not count as one of your stage Holomem');
});

test('hBP09-050 Art stacks one +20 per own stage Subaru with the printed +50 against a purple target', () => {
  const { state, customCards } = attackState({ subaruZones: ['collab', 'back1', 'back2'], purpleTarget: true });
  const result = useArt({ state, customCards });
  assert.equal(result.players[1].zones.center.damage, 210, '100 base + 60 for three own Subaru + 50 for the purple target');
});

test('hBP09-050 Art counts Center and Back top-card Subaru, but not an underlying or opposing Subaru', () => {
  const { state, customCards } = attackState({ opponentSubaru: true, purpleTarget: true });
  state.players[0].zones.collab = state.players[0].zones.center;
  state.players[0].zones.center = unit('hBP04-067');
  state.players[0].zones.back1 = unit('hBP04-067');
  state.players[0].zones.back2 = unit('hBP04-067');
  state.players[0].zones.back3 = unit('hBP09-064');
  state.players[0].zones.back3.stack = [instance('hBP04-067'), instance('hBP09-064')];

  const result = useArt({ state, customCards, sourceZone: 'collab' });
  assert.equal(result.players[1].zones.center.damage, 210, 'three own top-card Subaru add 60; the purple target adds 50');
});
