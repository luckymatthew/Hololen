import test from 'node:test';
import assert from 'node:assert/strict';
import { cards, pool, state, inst, unit, attack, fund } from './fixtures/simulator-audit.mjs';
const { applyAction, isActionCandidateLegal, legalAttachmentTargets } = await import(process.env.HOLO_ENGINE_TEST_TARGET || '../lib/simulator/engine.mjs');

test('Death-sensei turns every Mori Calliope Arts Cheer into colorless cost', () => {
  const s = state('hBP02-055');
  fund(s.players[0].zones.center, ['無色', '無色']);
  assert.equal(isActionCandidateLegal(s, 0, attack, pool), false, 'white Cheer cannot pay the printed purple cost without the Mascot');
  s.players[0].zones.center.attachments = [inst('hBP02-098', 'death-sensei')];
  assert.equal(isActionCandidateLegal(s, 0, attack, pool), true);
  const end = applyAction(s, 0, attack, pool, () => 0.5);
  assert.equal(end.players[1].zones.center.damage, cards.find(card => card.number === 'hBP02-055').arts[0].damage);
});

test('Sukonbu is Fubuki-only, copies stack HP, and prevent a baseline-HP knockout', () => {
  const fubuki = cards.find(card => card.group === 'holomem' && card.jpName === '白上フブキ' && card.stage === 'Debut');
  const other = cards.find(card => card.group === 'holomem' && card.jpName !== '白上フブキ' && card.stage === 'Debut');
  const fan = cards.find(card => card.number === 'hBP02-099');
  assert.ok(fubuki && other && fan);
  const owner = state().players[0];
  owner.zones.center = unit(fubuki.number);
  owner.zones.back1 = unit(other.number);
  assert.deepEqual(legalAttachmentTargets(owner, fan, pool), ['center']);

  const s = state('AUDIT-DUMMY', fubuki.number);
  s.players[1].zones.center.damage = fubuki.hp - 85;
  s.players[1].zones.center.attachments = [inst('hBP02-099', 'sukonbu-1'), inst('hBP02-099', 'sukonbu-2')];
  const end = applyAction(s, 0, attack, pool, () => 0.5);
  assert.ok(end.players[1].zones.center, 'the +10 HP Fan keeps Fubuki alive at her printed HP damage threshold');
  assert.equal(Boolean(end.players[1].zones.center.downPending), false);
});

test('each MioFa attached to Mio draws one card when she is knocked out during the opponent turn', () => {
  const mio = cards.find(card => card.group === 'holomem' && card.jpName === '大神ミオ' && card.stage === 'Debut');
  assert.ok(mio);
  const s = state('AUDIT-DUMMY', mio.number);
  s.players[1].zones.center = unit(mio.number, {
    damage: mio.hp - 10,
    attachments: [inst('hBP02-101', 'miofa-1'), inst('hBP02-101', 'miofa-2')],
  });
  s.players[1].mainDeck = [inst('AUDIT-DUMMY', 'draw-1'), inst('AUDIT-DUMMY', 'draw-2'), inst('AUDIT-DUMMY', 'deck-left')];
  s.effectQueue = [{ type: 'specialDamage', playerIndex: 0, targetPlayerIndex: 1, targetZone: 'center', sourceZone: 'center', amount: 10, loseLife: false, sourceName: 'fixture' }];

  const end = applyAction(s, 0, attack, pool, () => 0.5);

  assert.deepEqual(end.players[1].hand.map(card => card.id), ['draw-1', 'draw-2']);
});

test('Botan SP reads both front positions for its green gate and non-Debut target', () => {
  const green = cards.find(card => card.group === 'holomem' && card.colors?.includes('綠') && card.stage !== 'Debut');
  const otherColor = cards.find(card => card.group === 'holomem' && !card.colors?.includes('綠') && card.stage !== 'Debut');
  const debut = cards.find(card => card.group === 'holomem' && card.stage === 'Debut');
  assert.ok(green && otherColor && debut);

  const s = state();
  s.phase = 'main';
  s.players[0].oshi = inst('hBP03-002');
  s.players[0].holoPower = [inst('AUDIT-DUMMY', 'botan-power-1'), inst('AUDIT-DUMMY', 'botan-power-2')];
  s.players[0].zones.center = unit(otherColor.number);
  s.players[0].zones.collab = unit(green.number);
  s.players[1].zones.center = unit(debut.number);
  s.players[1].zones.collab = unit(otherColor.number);

  let end = applyAction(s, 0, { type: 'spOshiSkill' }, pool, () => 0.5);
  assert.deepEqual(end.pendingChoice.options, ['collab']);
  end = applyAction(end, 0, { type: 'choose', zone: 'collab' }, pool, () => 0.5);
  assert.equal(end.players[1].zones.collab.damage, 100);
  assert.equal(end.players[1].zones.center.damage, 0);
});

test('Watame SP attaches both top Cheer to the one selected Watame', () => {
  const watame = cards.find(card => card.group === 'holomem' && card.jpName === '角巻わため' && card.stage === 'Debut');
  assert.ok(watame);
  const s = state();
  s.phase = 'main';
  s.players[0].oshi = inst('hBP03-007');
  s.players[0].holoPower = [inst('AUDIT-DUMMY', 'watame-power-1'), inst('AUDIT-DUMMY', 'watame-power-2')];
  s.players[0].cheerDeck = [inst('hY06-001', 'top-cheer-1'), inst('hY06-001', 'top-cheer-2')];
  s.players[0].zones.back1 = unit(watame.number);
  s.players[0].zones.back2 = unit(watame.number);

  let end = applyAction(s, 0, { type: 'spOshiSkill' }, pool, () => 0.5);
  assert.deepEqual(end.pendingChoice.options, ['back1', 'back2']);
  end = applyAction(end, 0, { type: 'choose', zone: 'back1' }, pool, () => 0.5);
  assert.deepEqual(end.pendingChoice.options, ['back1']);
  end = applyAction(end, 0, { type: 'choose', zone: 'back1' }, pool, () => 0.5);
  assert.deepEqual(end.players[0].zones.back1.cheer.map(card => card.id), ['top-cheer-1', 'top-cheer-2']);
  assert.equal(end.players[0].zones.back2.cheer.length, 0);
});

test('Luna SP attaches one to four selected Lounights to chosen own Holomen', () => {
  const luna = cards.find(card => card.group === 'holomem' && card.jpName === '姫森ルーナ' && card.stage === 'Debut');
  assert.ok(luna);
  const s = state(luna.number);
  s.phase = 'main';
  s.players[0].oshi = inst('hBP03-001');
  s.players[0].holoPower = [inst('AUDIT-DUMMY', 'luna-power-1'), inst('AUDIT-DUMMY', 'luna-power-2')];
  s.players[0].zones.back1 = unit(luna.number);
  s.players[0].mainDeck = [inst('hBP03-105', 'knight-1'), inst('hBP03-105', 'knight-2'), inst('AUDIT-DUMMY', 'deck-left')];

  let end = applyAction(s, 0, { type: 'spOshiSkill' }, pool, () => 0.5);
  assert.deepEqual(end.pendingChoice.selectableIds, ['knight-1', 'knight-2']);
  end = applyAction(end, 0, { type: 'choose', cardIds: ['knight-1', 'knight-2'] }, pool, () => 0.5);
  end = applyAction(end, 0, { type: 'choose', zone: 'center' }, pool, () => 0.5);
  end = applyAction(end, 0, { type: 'choose', zone: 'back1' }, pool, () => 0.5);
  assert.deepEqual(end.players[0].zones.center.attachments.map(card => card.id), ['knight-1']);
  assert.deepEqual(end.players[0].zones.back1.attachments.map(card => card.id), ['knight-2']);
  assert.ok(!end.players[0].archive.some(card => card.id === 'knight-1' || card.id === 'knight-2'));
});

test('Miko SP bottoms chosen hand cards in order and draws back to five', () => {
  const red = cards.find(card => card.group === 'holomem' && card.colors?.includes('紅'));
  assert.ok(red);
  const s = state(red.number);
  s.phase = 'main';
  s.players[0].oshi = inst('hBP03-003');
  s.players[0].holoPower = [inst('AUDIT-DUMMY', 'miko-power-1'), inst('AUDIT-DUMMY', 'miko-power-2')];
  s.players[0].hand = [inst('AUDIT-DUMMY', 'bottom-1'), inst('AUDIT-DUMMY', 'bottom-2')];
  s.players[0].mainDeck = Array.from({ length: 5 }, (_, i) => inst('AUDIT-DUMMY', `draw-${i + 1}`));

  let end = applyAction(s, 0, { type: 'spOshiSkill' }, pool, () => 0.5);
  end = applyAction(end, 0, { type: 'choose', cardIds: ['bottom-1', 'bottom-2'] }, pool, () => 0.5);
  assert.deepEqual(end.players[0].hand.map(card => card.id), ['draw-1', 'draw-2', 'draw-3', 'draw-4', 'draw-5']);
  assert.deepEqual(end.players[0].mainDeck.map(card => card.id), ['bottom-1', 'bottom-2']);
});

test('FUWAMOCO SP grants Back targeting only to the chosen #Advent Holomen', () => {
  const advent = cards.find(card => card.group === 'holomem' && card.tags?.includes('#Advent'));
  assert.ok(advent);
  const s = state(advent.number);
  s.phase = 'main';
  s.players[0].oshi = inst('hBP03-004');
  s.players[0].holoPower = [inst('AUDIT-DUMMY', 'fuwamoco-power-1'), inst('AUDIT-DUMMY', 'fuwamoco-power-2')];
  s.players[0].zones.back1 = unit(advent.number);
  s.players[0].zones.center = unit('AUDIT-DUMMY');
  let end = applyAction(s, 0, { type: 'spOshiSkill' }, pool, () => 0.5);
  assert.deepEqual(end.pendingChoice.options, ['back1']);
  end = applyAction(end, 0, { type: 'choose', zone: 'back1' }, pool, () => 0.5);
  assert.ok(end.players[0].zones.back1.modifiers.some(modifier => modifier.kind === 'attackBack' && modifier.expiresTurn === end.turn));
  assert.equal(end.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'attackBack'), false);
});

test('FUWAMOCO normal Oshi attaches the Cheer deck top to 1st Mococo', () => {
  const mococo = cards.find(card => card.group === 'holomem' && card.jpName === 'モココ・アビスガード' && card.stage === '1st');
  assert.ok(mococo);
  const s = state(mococo.number);
  s.phase = 'main';
  s.players[0].oshi = inst('hBP03-004');
  s.players[0].holoPower = [inst('AUDIT-DUMMY', 'moco-power-1'), inst('AUDIT-DUMMY', 'moco-power-2'), inst('AUDIT-DUMMY', 'moco-power-3')];
  s.players[0].zones.back1 = unit(mococo.number);
  s.players[0].cheerDeck = [inst('hY06-001', 'top-mococo-cheer'), inst('hY01-001', 'next-mococo-cheer')];
  let end = applyAction(s, 0, { type: 'oshiSkill' }, pool, () => 0.5);
  assert.deepEqual(end.pendingChoice.options, ['center', 'back1']);
  end = applyAction(end, 0, { type: 'choose', zone: 'back1' }, pool, () => 0.5);
  assert.deepEqual(end.players[0].zones.back1.cheer.map(card => card.id), ['top-mococo-cheer']);
  assert.deepEqual(end.players[0].cheerDeck.map(card => card.id), ['next-mococo-cheer']);
});

test('Towa normal Oshi buffs #song only in Center and Collab', () => {
  const song = cards.find(card => card.group === 'holomem' && card.tags?.includes('#歌'));
  const other = cards.find(card => card.group === 'holomem' && !card.tags?.includes('#歌'));
  assert.ok(song && other);
  const s = state(song.number);
  s.phase = 'main';
  s.players[0].oshi = inst('hBP03-005');
  s.players[0].holoPower = [inst('AUDIT-DUMMY', 'towa-power-1'), inst('AUDIT-DUMMY', 'towa-power-2')];
  s.players[0].zones.collab = unit(song.number);
  s.players[0].zones.back1 = unit(song.number);
  s.players[0].zones.back2 = unit(other.number);
  const end = applyAction(s, 0, { type: 'oshiSkill' }, pool, () => 0.5);
  assert.ok(end.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 20));
  assert.ok(end.players[0].zones.collab.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 20));
  assert.equal(end.players[0].zones.back1.modifiers.some(modifier => modifier.kind === 'arts'), false);
  assert.equal(end.players[0].zones.back2.modifiers.some(modifier => modifier.kind === 'arts'), false);
});

test('Risu SP buffs every own Risu and does not buff unrelated Holomen', () => {
  const risu = cards.find(card => card.group === 'holomem' && card.jpName === 'アユンダ・リス');
  const other = cards.find(card => card.group === 'holomem' && card.jpName !== 'アユンダ・リス');
  assert.ok(risu && other);
  const s = state(risu.number);
  s.phase = 'main';
  s.players[0].oshi = inst('hBP03-008');
  s.players[0].holoPower = [inst('AUDIT-DUMMY', 'risu-power-1'), inst('AUDIT-DUMMY', 'risu-power-2')];
  s.players[0].zones.collab = unit(risu.number);
  s.players[0].zones.back1 = unit(other.number);
  const end = applyAction(s, 0, { type: 'spOshiSkill' }, pool, () => 0.5);
  assert.ok(end.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 50));
  assert.ok(end.players[0].zones.collab.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 50));
  assert.equal(end.players[0].zones.back1.modifiers.some(modifier => modifier.kind === 'arts'), false);
});

for (const [oshiNumber, matchingCard] of [['hBP03-001', 'hBP02-076'], ['hBP03-007', 'hBP03-105']]) {
  test(`${oshiNumber} requires taking a matching searched card when one is found`, () => {
    const s = state();
    s.phase = 'main';
    s.players[0].oshi = inst(oshiNumber);
    s.players[0].holoPower = [inst('AUDIT-DUMMY', `${oshiNumber}-power-1`), inst('AUDIT-DUMMY', `${oshiNumber}-power-2`)];
    s.players[0].mainDeck = [inst(matchingCard, `${oshiNumber}-eligible`), inst('AUDIT-DUMMY', `${oshiNumber}-other`)];
    let end = applyAction(s, 0, { type: 'oshiSkill' }, pool, () => 0.5);
    assert.equal(end.pendingChoice.optional, false);
    assert.throws(() => applyAction(end, 0, { type: 'choose', skip: true }, pool, () => 0.5));
    end = applyAction(end, 0, { type: 'choose', cardIds: [`${oshiNumber}-eligible`] }, pool, () => 0.5);
    assert.deepEqual(end.players[0].hand.map(card => card.id), [`${oshiNumber}-eligible`]);
    assert.equal(end.players[0].holoPower.length, 0);
  });

  test(`${oshiNumber} still shuffles and completes with no matching searched card`, () => {
    const s = state();
    s.phase = 'main';
    s.players[0].oshi = inst(oshiNumber);
    s.players[0].holoPower = [inst('AUDIT-DUMMY', `${oshiNumber}-empty-power-1`), inst('AUDIT-DUMMY', `${oshiNumber}-empty-power-2`)];
    s.players[0].mainDeck = [inst('AUDIT-DUMMY', `${oshiNumber}-deck-1`), inst('hY01-001', `${oshiNumber}-deck-2`), inst('hBP02-079', `${oshiNumber}-deck-3`)];
    let shuffleCalls = 0;
    const end = applyAction(s, 0, { type: 'oshiSkill' }, pool, () => { shuffleCalls += 1; return 0; });
    assert.equal(end.pendingChoice, null);
    assert.equal(end.players[0].hand.length, 0);
    assert.equal(end.players[0].holoPower.length, 0);
    assert.equal(shuffleCalls, 2, 'three remaining cards are shuffled once');
  });
}
