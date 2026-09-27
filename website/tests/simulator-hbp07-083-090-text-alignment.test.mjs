import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { pool, inst, unit, state, fund, attack } from './fixtures/simulator-audit.mjs';

const act = (s, playerIndex, action, random = () => 0) => applyAction(s, playerIndex, action, pool, random);

test('hBP07-083 Arts can archive only a Center or Collab opponent Cheer', () => {
  let s = state('hBP07-083', 'AUDIT-DUMMY');
  fund(s.players[0].zones.center, ['黃', '無色', '無色']);
  s.players[1].zones.center.cheer = [inst('hY01-001', 'opp-center-cheer')];
  s.players[1].zones.collab = unit('AUDIT-DUMMY', { cheer: [inst('hY02-001', 'opp-collab-cheer')] });
  s.players[1].zones.back1 = unit('AUDIT-DUMMY', { cheer: [inst('hY03-001', 'opp-back-cheer')] });
  s = act(s, 0, attack);
  assert.equal(s.pendingChoice.effect, 'artOpponentCheerBottom');
  assert.deepEqual(s.pendingChoice.cheerOptions.map((option) => option.zone), ['center', 'collab']);
  s = act(s, 0, { type: 'choose', cheerId: 'opp-collab-cheer' });
  assert.deepEqual(s.players[1].zones.collab.cheer, []);
  assert.equal(s.players[1].zones.back1.cheer[0].id, 'opp-back-cheer');
  assert.equal(s.players[1].cheerDeck.at(-1).id, 'opp-collab-cheer');
});

test('hBP07-083 Arts gains its printed bonus against a red target', () => {
  let s = state('hBP07-083', 'hBP01-061');
  fund(s.players[0].zones.center, ['黃', '無色', '無色']);
  s = act(s, 0, attack);
  assert.equal(s.players[1].zones.center.damage, 150);
});

test('hBP07-083 Center Bloom buffs both sides and adds +60 only to own 2nd Nene', () => {
  let s = state('hBP07-081', 'hBP07-081');
  s.phase = 'main';
  s.players[0].zones.back1 = unit('hBP07-081');
  s.players[0].zones.collab = unit('hBP07-083');
  s.players[0].hand = [inst('hBP07-083', 'bloom')];
  s = act(s, 0, { type: 'play', cardId: 'bloom' });
  s = act(s, 0, { type: 'choose', zone: 'center' });

  const total = (stage) => (stage.modifiers || []).filter((modifier) => modifier.sourceNumber === 'hBP07-083').reduce((sum, modifier) => sum + modifier.amount, 0);
  assert.equal(total(s.players[0].zones.center), 100, 'the newly bloomed 2nd gets +40 and +60');
  assert.equal(total(s.players[0].zones.back1), 40, 'own 1st Nene gets only the all-stage +40');
  assert.equal(total(s.players[0].zones.collab), 100, 'own 2nd Nene gets +40 and +60');
  assert.equal(total(s.players[1].zones.center), 40, 'opponent Holomen also gets +40');
});

test('hBP07-086 Collab grants a Gigi back-attack, and its Arts gets +30 vs damaged targets', () => {
  let s = state('hBP07-086', 'hBP05-050');
  s.phase = 'main';
  s.players[0].zones.back1 = unit('hBP07-086');
  fund(s.players[0].zones.back1, ['黃', '黃', '無色']);
  s.players[1].zones.back1 = unit('hBP05-050', { damage: 1 });
  s = act(s, 0, { type: 'collab', zone: 'back1' });
  assert.equal(s.pendingChoice.effect, 'attackDamagedBack');
  assert.ok(s.pendingChoice.options.includes('collab'));
  s = act(s, 0, { type: 'choose', zone: 'collab' });
  s.phase = 'performance';
  s = act(s, 0, { type: 'attack', sourceZone: 'collab', targetZone: 'back1', artIndex: 0 });
  assert.equal(s.players[1].zones.back1.damage, 241);
});

test('hBP07-088 Gift prevents special damage to a back-row FLOW GLOW 1st', () => {
  const s = state('AUDIT-DUMMY', 'hBP07-088');
  s.players[1].zones.back1 = unit('hBP07-089');
  s.effectQueue = [{
    type: 'specialDamage', playerIndex: 0, targetPlayerIndex: 1, targetZone: 'back1',
    amount: 60, loseLife: true, sourceZone: 'center', sourceName: 'audit', reactionsChecked: false,
  }];
  const after = act(s, 0, attack);
  assert.equal(after.players[1].zones.back1.damage, 0);
});

for (const [targetNumber, expectedDamage] of [['hBP01-023', 190], ['hBP01-061', 140]]) {
  test(`hBP07-090 Arts counts attached Cheer and its color bonus (${targetNumber})`, () => {
    let s = state('hBP07-090', targetNumber);
    fund(s.players[0].zones.center, ['黃', '黃', '無色']);
    s = act(s, 0, attack);
    assert.equal(s.players[1].zones.center.damage, expectedDamage);
  });
}
