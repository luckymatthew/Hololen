import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixture, cards, unit, instance, act, answer } from './hbp09-fixtures.mjs';

const towa = cards.find(card => card.number === 'hBP09-051');

function artsState({ legalBackSong = false } = {}) {
  const state = fixture();
  state.turn = 8;
  state.phase = 'performance';
  state.activePlayer = 0;
  for (const player of state.players) {
    player.turnsTaken = 3;
    player.turnEvents = { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  }
  const own = state.players[0];
  const opponent = state.players[1];
  own.zones = { center: unit('hBP09-051'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  own.zones.center.cheer = [instance('hY04-014'), instance('hY01-015')];
  own.zones.collab = unit('hBP01-013'); // #歌, but not in Back.
  own.zones.back1 = unit(legalBackSong ? 'hBP01-013' : 'hBP09-049');
  own.zones.back2 = unit('hBP09-049'); // no #歌.
  opponent.zones = { center: unit('hBP09-064'), collab: null, back1: unit('hBP09-052'), back2: null, back3: null, back4: null, back5: null };
  return state;
}

function useSecondArt(state) {
  return act(state, { type: 'attack', sourceZone: 'center', artIndex: 1, targetZone: 'center' });
}

test('official hBP09-051 C/S identity and Japanese Arts text match the current catalogue', () => {
  assert.ok(towa);
  assert.equal(towa.jpName, '常闇トワ');
  assert.equal(towa.stage, 'Debut');
  assert.equal(towa.hp, 130);
  assert.deepEqual(towa.colors, ['藍']);
  assert.deepEqual(new Set(towa.variants.map(variant => variant.rarity)), new Set(['C', 'S']));
  assert.deepEqual(towa.arts[1].cost, ['藍', '無色']);
  assert.equal(towa.arts[1].damage, 30);
  assert.equal(towa.arts[1].effect, 'このホロメンのエール1枚を自分の#歌を持つバックホロメンに付け替えられる。');
});

test('the optional transfer only exposes this Towa\'s Cheer and an own Back #歌 Holomem', () => {
  let state = useSecondArt(artsState({ legalBackSong: true }));
  const initial = state.players[0].zones.center.cheer.map(card => card.id);
  assert.equal(state.players[0].zones.center.rested, true);
  assert.equal(state.pendingChoice?.type, 'cardSelection');
  assert.equal(state.pendingChoice?.optional, true);
  assert.equal(state.pendingChoice?.min, 1);
  assert.equal(state.pendingChoice?.max, 1);
  assert.deepEqual(new Set(state.pendingChoice.cards.map(card => card.id)), new Set(initial), 'other units\' Cheer must not be selectable');

  const chosenId = initial[0];
  state = answer(state, { cardIds: [chosenId] });
  assert.equal(state.pendingChoice?.type, 'stageTarget');
  assert.deepEqual(state.pendingChoice.options, ['back1'], 'Center/Collab, non-singing Back and opposing Back are illegal destinations');
  state = answer(state, { zone: 'back1' });
  assert.equal(state.pendingChoice, null);
  assert.deepEqual(state.players[0].zones.center.cheer.map(card => card.id), [initial[1]], 'the selected Cheer leaves this Holomem');
  assert.deepEqual(state.players[0].zones.back1.cheer.map(card => card.id), [chosenId], 'the same Cheer is attached to the chosen Back Holomem');
  assert.equal(state.players[0].zones.collab.cheer.length, 0);
  assert.equal(state.players[0].zones.back2.cheer.length, 0);
  assert.equal(state.players[1].zones.back1.cheer.length, 0);
  assert.equal(state.players[1].zones.center.damage, 30);
});

test('without an own Back #歌 target, resolve the 30 damage without presenting a no-op transfer choice', () => {
  const state = useSecondArt(artsState());
  assert.equal(state.pendingChoice, null, 'no legal recipient means there is no optional Cheer selection');
  assert.equal(state.players[1].zones.center.damage, 30);
  assert.equal(state.players[0].zones.center.cheer.length, 2, 'unmoved Arts Cheer stays attached');
});

test('declining the available optional transfer leaves Cheer in place and keeps Arts damage', () => {
  let state = useSecondArt(artsState({ legalBackSong: true }));
  const cheerIds = state.players[0].zones.center.cheer.map(card => card.id);
  state = answer(state, { skip: true });
  assert.equal(state.pendingChoice, null);
  assert.deepEqual(state.players[0].zones.center.cheer.map(card => card.id), cheerIds);
  assert.equal(state.players[0].zones.back1.cheer.length, 0);
  assert.equal(state.players[1].zones.center.damage, 30);
});
