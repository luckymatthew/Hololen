import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, settle } from './hbp09-fixtures.mjs';

const whiteCheer = count => Array.from({ length: count }, () => instance('hY01-015'));
const arts = (sourceZone = 'center', artIndex = 0) => ({ type: 'attack', sourceZone, artIndex, targetZone: 'center' });

function rionaArtsFixture({ sourceZone = 'center', completeRoster = true, collab = 'hBP07-087' } = {}) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'performance';
  const owner = state.players[0];
  owner.zones = {
    center: sourceZone === 'center' ? unit('hBP09-024') : unit('hBP09-064'),
    collab: sourceZone === 'collab' ? unit('hBP09-024') : unit(collab),
    back1: unit('hBP08-047'),
    back2: unit('hBP07-032'),
    back3: completeRoster ? unit('hBP09-064') : null,
    back4: null,
    back5: null,
  };
  if (sourceZone === 'center') owner.zones.center.cheer = whiteCheer(2);
  else owner.zones.collab.cheer = whiteCheer(2);
  state.players[1].zones.center = unit('hBP09-023');
  state.players[1].zones.center.damage = 0;
  return state;
}

test('hBP09-024 official card identity, Japanese abilities and R/SR printings are represented in the current catalog', () => {
  const riona = cards.find(card => card.number === 'hBP09-024');
  assert.ok(riona);
  assert.equal(riona.jpName, '響咲リオナ');
  assert.equal(riona.typeCode, 'buzzCharacter');
  assert.deepEqual(riona.variants.map(variant => variant.rarity).sort(), ['R', 'SR']);
  assert.equal(riona.arts[0].damage, 70);
  assert.equal(riona.arts[0].damageModifier, '+');
  assert.match(riona.keyword.effect, /#FLOW GLOW/u);
  assert.match(riona.extra, /ライフ-2/u);
});

test('hBP09-024 adds exactly 100 to Center Arts only when all four named Holomem are on its own stage', () => {
  const complete = rionaArtsFixture();
  const buffed = act(complete, arts(), 0, cards);
  assert.equal(buffed.players[1].zones.center.damage, 170);
  assert.equal(buffed.players[0].zones.center.cheer.length, 2, 'the two White Arts payment stays attached');

  const missingName = rionaArtsFixture({ completeRoster: false });
  const baseOnly = act(missingName, arts(), 0, cards);
  assert.equal(baseOnly.players[1].zones.center.damage, 70);

  const collabSource = rionaArtsFixture({ sourceZone: 'collab' });
  const collabOnly = act(collabSource, arts('collab'), 0, cards);
  assert.equal(collabOnly.players[1].zones.center.damage, 70, 'the printed +100 condition is Center-only');
});

test('hBP09-024 Center Gift changes every required color, but not the Cheer count, for a FLOW GLOW Collab Arts', () => {
  const state = rionaArtsFixture({ collab: 'hBP09-070' });
  state.players[0].zones.collab.cheer = whiteCheer(3);
  const result = act(state, arts('collab'), 0, cards);
  assert.equal(result.players[1].zones.center.damage, 120);
  assert.equal(result.players[0].zones.collab.cheer.length, 3, 'three colorless requirements still need three Cheer, which remain attached');
});

test('hBP09-024 Gift does not waive colors without its Center source or for an untagged Collab', () => {
  const cases = [
    { state: rionaArtsFixture({ sourceZone: 'center', collab: 'hBP09-070' }), center: 'hBP09-023' },
    { state: rionaArtsFixture({ collab: 'hBP09-053' }), center: 'hBP09-024' },
  ];
  for (const { state, center } of cases) {
    state.players[0].zones.center = unit(center);
    state.players[0].zones.collab = unit(state.players[0].zones.collab.stack[0].number);
    state.players[0].zones.collab.cheer = whiteCheer(3);
    const before = JSON.stringify(state);
    assert.throws(() => act(state, arts('collab', state.players[0].zones.collab.stack[0].number === 'hBP09-053' ? 1 : 0), 0, cards), /無效|不足/u);
    assert.equal(JSON.stringify(state), before, 'an unpaid Arts does not change game state');
  }
});

test('hBP09-024 Buzz Extra loses exactly two of its owner’s Life when it is Downed', () => {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'performance';
  state.players[0].oshi = instance('hBP09-001');
  state.players[0].zones.center = unit('hBP09-023');
  state.players[0].zones.center.cheer = whiteCheer(3);
  state.players[1].zones.center = unit('hBP09-024');
  state.players[1].zones.center.damage = 120;
  state.players[1].life = Array.from({ length: 5 }, () => instance('hY01-001'));

  const result = settle(act(state, arts(), 0, cards), cards);
  assert.equal(result.players[1].zones.center, null);
  assert.equal(result.players[1].life.length, 3);
  assert.equal(result.lifeLosses.filter(loss => loss.ownerIndex === 1).length, 2);
});
