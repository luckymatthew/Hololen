import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, state, unit, inst, attack, fund } from './fixtures/simulator-audit.mjs';

// Expected damage comes from independently inspected official printed icons:
// id=2491/2492/2498/2499. It is not derived from the fields being tested.
const verified = JSON.parse(readFileSync(new URL('../scripts/verified-art-bonuses.json', import.meta.url)));
const act = (s, action = attack) => applyAction(s, s.pendingChoice?.playerIndex ?? 0, action, pool, () => 0);
const art = number => cards.find(card => card.number === number).arts[0];
const armed = (number, target) => {
  const s = state(number, target);
  fund(s.players[0].zones.center, art(number).cost);
  return s;
};

test('four official image-backed bonuses use exact engine color labels and values', () => {
  assert.deepEqual(verified.corrections.map(row => [row.number, row.artIndex, row.after.specialTargets, row.after.specialValues]), [
    ['hEB01-016', 0, ['白'], [50]], ['hEB01-017', 0, ['紅'], [50]],
    ['hEB01-023', 0, ['白'], [50]], ['hEB01-024', 0, ['白'], [50]],
  ]);
  for (const row of verified.corrections) {
    assert.equal(art(row.number).name, row.artName);
    assert.deepEqual(art(row.number).specialTargets, row.after.specialTargets);
    assert.deepEqual(art(row.number).specialValues, [50]);
    assert.match(row.imageSha256, /^[a-f0-9]{64}$/);
  }
  assert.ok(cards.find(card => card.number === 'hBP02-017').colors.includes('白'));
  assert.ok(cards.find(card => card.number === 'hBP02-034').colors.includes('紅'));
  assert.ok(!cards.find(card => card.number === 'hBP07-054').colors.includes('白'));
});

test('hEB01-016 real damage combines independent White and three-underlay bonuses', () => {
  for (const [underlays, target, expected] of [[2, 'hBP02-017', 90], [3, 'hBP02-017', 140], [2, 'hBP07-054', 40], [3, 'hBP07-054', 90]]) {
    const s = armed('hEB01-016', target);
    s.players[0].zones.center.stack = [...Array.from({ length: underlays }, (_, i) => inst('hEB01-011', `under-${i}`)), inst('hEB01-016', 'top')];
    assert.equal(act(s).players[1].zones.center.damage, expected, `${underlays} underlays vs ${target}`);
  }
});

test('hEB01-017 real Red +50 applies without Marine Oshi and does not enable the gated underlay cost', () => {
  for (const [target, expected] of [['hBP02-034', 150], ['hBP02-017', 100]]) {
    const s = armed('hEB01-017', target);
    s.players[0].oshi = inst('hEB01-001');
    s.players[0].zones.center.stack = [...Array.from({ length: 5 }, (_, i) => inst('hEB01-011', `under-${i}`)), inst('hEB01-017')];
    const result = act(s);
    assert.equal(result.players[1].zones.center.damage, expected);
    assert.equal(result.pendingChoice, null);
    assert.equal(result.players[0].archive.length, 0);
  }
});

test('hEB01-017 Red bonus stacks with paid five-underlay bonus and preserves non-Debut Back targeting', () => {
  let s = armed('hEB01-017', 'hBP07-048');
  s.players[0].oshi = inst('hEB01-002');
  const underlays = ['hEB01-011', 'hEB01-012', 'hEB01-013', 'hEB01-014', 'hEB01-015'].map((number, i) => inst(number, `under-${i}`));
  s.players[0].zones.center.stack = [...underlays, inst('hEB01-017')];
  s.players[1].zones.back1 = unit('hEB01-013');
  s.players[1].zones.back2 = unit('hEB01-011');
  s = act(s);
  assert.equal(s.pendingChoice.effect, 'artUnderCardCost');
  s = act(s, { type: 'choose', cardIds: underlays.map(card => card.id) });
  assert.equal(s.effectQueue.find(effect => effect.type === 'dealArtsDamage').damage, 250);
  assert.deepEqual(s.pendingChoice.options, ['back1']);
  s = act(s, { type: 'choose', zone: 'back1' });
  assert.equal(s.players[1].zones.center.damage, 250);
  assert.equal(s.players[1].zones.back1.damage, 100);
  assert.equal(s.players[1].zones.back2.damage, 0);
  assert.ok(underlays.every(card => s.players[0].archive.some(item => item.id === card.id)));
});

test('hEB01-023 White/nonwhite real damage preserves draw-to-Assistant-count behavior', () => {
  for (const [target, expected] of [['hBP02-017', 100], ['hBP07-054', 50]]) {
    const s = armed('hEB01-023', target);
    s.players[0].zones.center.attachments = [inst('hBP04-105', 'assistant-a'), inst('hBP04-105', 'assistant-b')];
    s.players[0].zones.back1 = unit('hEB01-021', { attachments: [inst('hBP04-105', 'assistant-c')] });
    s.players[0].hand = [inst('hBP04-105', 'held')];
    const result = act(s);
    assert.equal(result.players[1].zones.center.damage, expected);
    assert.equal(result.players[0].hand.length, 3);
    assert.equal(result.players[0].mainDeck.length, 28);
  }
});

test('hEB01-024 White/nonwhite real damage preserves cost reduction, revealed Holomen bonus and healing', () => {
  for (const [target, expected] of [['hBP02-017', 190], ['hBP07-054', 140]]) {
    let s = state('hEB01-024', target);
    fund(s.players[0].zones.center, ['黃', '無色']);
    s.players[0].zones.center.attachments = [inst('hBP04-105', 'assistant')];
    s.players[0].zones.back1 = unit('hEB01-021', { damage: 30 });
    s.players[0].mainDeck = [inst('hEB01-021', 'revealed-holomem'), inst('hBP04-105', 'revealed-support')];
    s = act(s);
    assert.equal(s.pendingChoice.type, 'healDistribution');
    assert.equal(s.pendingChoice.count, 1);
    s = act(s, { type: 'choose', allocations: { back1: 1 } });
    assert.equal(s.players[1].zones.center.damage, expected);
    assert.equal(s.players[0].zones.back1.damage, 10);
    assert.equal(s.players[0].mainDeck.length, 2);
  }
});
