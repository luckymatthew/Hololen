import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, state, unit, inst, dummy, attack } from './fixtures/simulator-audit.mjs';

const trigger = {
  ...dummy,
  number: 'AUDIT-HBP09-017-EFFECT-TRIGGER',
  arts: [{ name: 'zero damage trigger', damage: 0, cost: [], effect: '' }],
};
const runtimeCards = [...pool, trigger];

function receive({ kind = 'arts', amount = 30, zone = 'center', bloomTop = false } = {}) {
  const current = state(trigger.number, trigger.number);
  current.phase = 'performance';
  current.players[1].zones[zone] = unit('hBP09-017');
  if (bloomTop) current.players[1].zones[zone].stack.push(inst('hBP09-018', 'bloom-top'));
  current.players[1].zones.collab ||= unit(trigger.number);
  current.players[1].zones.center ||= unit(trigger.number);
  current.effectQueue = [kind === 'arts'
    ? { type: 'dealArtsDamage', playerIndex: 0, targetPlayerIndex: 1, targetZone: zone, sourceZone: 'center', damage: amount, sourceName: 'audit', artName: 'audit' }
    : { type: 'specialDamage', playerIndex: 0, targetPlayerIndex: 1, targetZone: zone, sourceZone: 'center', amount, loseLife: false, sourceName: 'audit' }];
  const actionTargetZone = zone === 'center' ? 'collab' : 'center';
  const result = applyAction(current, 0, { ...attack, targetZone: actionTargetZone }, runtimeCards, () => 0.5);
  return result.players[1].zones[zone];
}

test('hBP09-017 Gift reduces Arts damage by exactly 30 in Center, Collab and Back', () => {
  for (const zone of ['center', 'collab', 'back1']) {
    assert.equal(receive({ zone, amount: 100 }).damage, 70, `${zone} receives 100 Arts damage minus 30`);
  }
});

test('hBP09-017 Gift reduction is floored at zero and does not affect Special damage', () => {
  assert.equal(receive({ amount: 20 }).damage, 0, '20 Arts damage minus 30 cannot become negative');
  assert.equal(receive({ kind: 'special', amount: 30 }).damage, 30, 'the Gift names Arts damage only');
});

test('hBP09-017 Gift is inactive below a different Bloom top card', () => {
  const result = receive({ amount: 100, bloomTop: true });
  assert.equal(result.stack.at(-1).number, 'hBP09-018');
  assert.equal(result.damage, 100, 'only the current top card supplies active Holomem abilities');
});

test('official catalog and packaged variants retain hBP09-017 Japanese Gift and vanilla Arts', () => {
  const card = cards.find(entry => entry.number === 'hBP09-017');
  assert.ok(card);
  assert.deepEqual(new Set(card.variants.map(variant => variant.id)), new Set(['hbp09-hBP09-017_C', 'hbp09-hBP09-017_S']));
  assert.equal(card.keyword.name, '喧騒の中の密事');
  assert.equal(card.keyword.effect, 'このホロメンが受けるアーツダメージ-30。');
  assert.equal(card.arts[0].name, '待ち合わせの角で');
  assert.equal(card.arts[0].damage, 30);
  assert.deepEqual(card.arts[0].cost, ['無色']);
  assert.equal(card.arts[0].effect, '');
});
