import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, state, unit, inst } from './fixtures/simulator-audit.mjs';

const act = (s, playerIndex, action) => applyAction(structuredClone(s), playerIndex, action, pool, () => 0.5);

function pekoraDown({ otherHolomen }) {
  const downCard = cards.find((card) => card.number === 'hBP01-076');
  const s = state();
  s.phase = 'main';
  s.activePlayer = 0;
  s.players[1].oshi = inst('hBP01-004');
  s.players[1].holoPower = [inst('AUDIT-DUMMY', 'power-1'), inst('AUDIT-DUMMY', 'power-2')];
  s.players[1].zones = {
    center: unit('hBP01-076', { damage: downCard.hp - 20, cheer: [inst('hY02-001', 'green-cheer')] }),
    collab: null,
    back1: otherHolomen ? unit('hBP01-076') : null,
    back2: null,
    back3: null,
    back4: null,
    back5: null,
  };
  s.effectQueue = [{
    type: 'specialDamage', playerIndex: 0, targetPlayerIndex: 1, targetZone: 'center',
    amount: 30, loseLife: false, sourceName: 'Audit hit', sourceZone: 'center',
  }];
  return s;
}

test('hBP01-004 does not offer Cheer transfer when the downed Holomen is the only own Holomen', () => {
  const s = act(pekoraDown({ otherHolomen: false }), 0, { type: 'advance' });
  assert.notEqual(s.pendingChoice?.effect, 'oshiKnockout');
  assert.notEqual(s.pendingChoice?.effect, 'koTransferCheer');
});

test('hBP01-004 transfers the downed Holomen green Cheer to another own Holomen', () => {
  let s = act(pekoraDown({ otherHolomen: true }), 0, { type: 'advance' });
  assert.equal(s.pendingChoice?.effect, 'oshiKnockout');
  s = act(s, 1, { type: 'choose', optionId: 'use' });
  assert.equal(s.pendingChoice?.effect, 'koTransferCheer');
  assert.deepEqual(s.pendingChoice.selectableIds, ['green-cheer']);
  s = act(s, 1, { type: 'choose', cardIds: ['green-cheer'] });
  assert.equal(s.pendingChoice?.type, 'stageTarget');
  assert.deepEqual(s.pendingChoice.options, ['back1']);
  s = act(s, 1, { type: 'choose', zone: 'back1' });
  assert.equal(s.players[1].zones.back1.cheer[0]?.id, 'green-cheer');
});
