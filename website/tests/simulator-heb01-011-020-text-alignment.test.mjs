import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, attack } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
// Use the actual shipped offline runtime catalog, whose printed icons were correct.
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/app/offline-cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const { applyAction: androidApplyAction } = await import(androidEngineUrl.href);
  const androidCards = JSON.parse(readFileSync(androidCardsUrl, 'utf8')).cards;
  runtimes.push({ name: 'Android source engine with shipped offline catalog', applyAction: androidApplyAction, cards: androidCards });
}
for (const runtime of runtimes) runtime.pool = [...runtime.cards, dummy, oshi];

const cheer = (unitState, numbers) => { unitState.cheer = numbers.map((number, index) => inst(number, `cheer-${index}`)); };

for (const runtime of runtimes) {
  const { applyAction, cards, pool } = runtime;

  test(`${runtime.name}: hEB01-012/013/014/019/020 basic Arts use their printed damage and Cheer costs`, () => {
    for (const entry of [
      { number: 'hEB01-012', damage: 30, colors: ['hY01-001'] },
      { number: 'hEB01-013', damage: 50, colors: ['hY01-001', 'hY01-001'] },
      { number: 'hEB01-014', damage: 30, colors: ['hY04-001'] },
      { number: 'hEB01-019', damage: 10, colors: ['hY01-001'] },
      { number: 'hEB01-020', damage: 30, colors: ['hY01-001'] },
    ]) {
      let s = state(entry.number);
      cheer(s.players[0].zones.center, entry.colors);
      s = applyAction(s, 0, { ...attack, artIndex: 0 }, pool, () => 0);
      assert.equal(s.players[1].zones.center.damage, entry.damage, `${entry.number} base Art`);
    }
  });

  test(`${runtime.name}: hEB01-011 archives one of its Cheer then finds one #サマー Marine`, () => {
    const target = cards.find(card => card.jpName === '宝鐘マリン' && card.tags.includes('#サマー'));
    assert.ok(target, 'catalog must include a summer Marine');
    let s = state('hEB01-011');
    cheer(s.players[0].zones.center, ['hY04-001']);
    s.players[0].mainDeck = [inst(target.number, 'summer-marine'), inst('AUDIT-DUMMY', 'remain')];
    s = applyAction(s, 0, { ...attack }, pool, () => 0);
    assert.equal(s.pendingChoice.optional, true);
    assert.equal(s.pendingChoice.max, 1);
    s = applyAction(s, 0, { type: 'choose', cheerId: 'cheer-0' }, pool, () => 0);
    assert.equal(s.pendingChoice.effect, 'deckToHandShuffle');
    assert.equal(s.pendingChoice.optional, false);
    s = applyAction(s, 0, { type: 'choose', cardIds: ['summer-marine'] }, pool, () => 0);
    assert.ok(s.players[0].archive.some(card => card.id === 'cheer-0'));
    assert.ok(s.players[0].hand.some(card => card.id === 'summer-marine'));
  });

  test(`${runtime.name}: hEB01-012/019 Collab searches trigger only on the second player's first turn`, () => {
    const marineBloom = cards.find(card => card.jpName === '宝鐘マリン' && ['bloom', 'bloom_effect'].includes(card.keyword?.type));
    const koyolab = cards.find(card => card.group === 'support' && card.tags.includes('#こよラボ'));
    assert.ok(marineBloom && koyolab);
    const run = (number, eligible) => {
      let s = state();
      s.phase = 'main';
      s.firstPlayer = 1;
      s.players[0].turnsTaken = eligible ? 1 : 2;
      s.players[0].zones.back1 = unit(number);
      const targets = number === 'hEB01-012'
        ? [inst(marineBloom.number, 'marine')]
        : [inst('hEB01-018', 'debut'), inst(koyolab.number, 'koyolab')];
      s.players[0].mainDeck = [inst('hY01-001', 'collab-power'), ...targets];
      s = applyAction(s, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
      return s;
    };
    const eligibleMarine = run('hEB01-012', true);
    assert.equal(eligibleMarine.pendingChoice.optional, false);
    assert.equal(eligibleMarine.pendingChoice.selectableIds.includes('marine'), true);
    const ineligibleMarine = run('hEB01-012', false);
    assert.equal(ineligibleMarine.pendingChoice, null);

    let eligibleKoyori = run('hEB01-019', true);
    assert.equal(eligibleKoyori.pendingChoice.optional, false);
    eligibleKoyori = applyAction(eligibleKoyori, 0, { type: 'choose', cardIds: ['debut'] }, pool, () => 0);
    assert.equal(eligibleKoyori.pendingChoice.optional, false);
    eligibleKoyori = applyAction(eligibleKoyori, 0, { type: 'choose', cardIds: ['koyolab'] }, pool, () => 0);
    assert.ok(eligibleKoyori.players[0].hand.some(card => card.id === 'debut'));
    assert.ok(eligibleKoyori.players[0].hand.some(card => card.id === 'koyolab'));
    const ineligibleKoyori = run('hEB01-019', false);
    assert.equal(ineligibleKoyori.pendingChoice, null);
  });

  test(`${runtime.name}: hEB01-013 Collab archives one underlay then attaches the top Cheer`, () => {
    let s = state();
    s.phase = 'main';
    s.players[0].zones.back1 = unit('hEB01-013', { stack: [inst('hEB01-011', 'underlay'), inst('hEB01-013', 'marine-collab')] });
    s.players[0].mainDeck = [inst('hY01-001', 'collab-power')];
    s.players[0].cheerDeck = [inst('hY04-001', 'top-cheer')];
    s = applyAction(s, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(s.pendingChoice.optional, true);
    s = applyAction(s, 0, { type: 'choose', cardIds: ['underlay'] }, pool, () => 0);
    assert.ok(s.players[0].archive.some(card => card.id === 'underlay'));
    assert.equal(s.pendingChoice.type, 'eventCheerTarget');
    s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
    assert.ok(s.players[0].zones.center.cheer.some(card => card.id === 'top-cheer'));
  });

  test(`${runtime.name}: hEB01-014 Bloom deals 10 special damage to an opposing Back only when one exists`, () => {
    const run = (withBack) => {
      let s = state('hEB01-011');
      s.phase = 'main';
      s.players[0].hand = [inst('hEB01-014', 'marine-bloom')];
      if (withBack) s.players[1].zones.back1 = unit('AUDIT-DUMMY');
      s = applyAction(s, 0, { type: 'play', cardId: 'marine-bloom' }, pool, () => 0);
      return applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
    };
    const valid = run(true);
    assert.equal(valid.pendingChoice.optional, false);
    assert.deepEqual(valid.pendingChoice.options, ['back1']);
    let resolved = applyAction(valid, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
    assert.equal(resolved.players[1].zones.back1.damage, 10);
    assert.equal(valid.pendingChoice.meta.amount, 10);
    assert.equal(run(false).pendingChoice, null);
  });

  test(`${runtime.name}: hEB01-015 Arts needs two underlays and its optional Cheer payment grants the top Cheer`, () => {
    let s = state('hEB01-015');
    s.players[0].zones.center.stack = [inst('hEB01-011', 'under-1'), inst('hEB01-012', 'under-2'), inst('hEB01-015', 'marine-top')];
    cheer(s.players[0].zones.center, ['hY04-001', 'hY01-001']);
    s.players[0].cheerDeck = [inst('hY03-001', 'new-cheer')];
    s = applyAction(s, 0, { ...attack }, pool, () => 0);
    assert.equal(s.pendingChoice.optional, true);
    s = applyAction(s, 0, { type: 'choose', cheerId: 'cheer-0' }, pool, () => 0);
    assert.equal(s.pendingChoice.type, 'eventCheerTarget');
    s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
    assert.ok(s.players[0].archive.some(card => card.id === 'cheer-0'));
    assert.ok(s.players[0].zones.center.cheer.some(card => card.id === 'new-cheer'));
  });

  test(`${runtime.name}: hEB01-015 Buzz Down Extra costs two Life`, () => {
    const card = cards.find(candidate => candidate.number === 'hEB01-015');
    assert.match(card.type, /Buzz/u);
    let s = state('AUDIT-DUMMY', 'hEB01-015');
    s.players[1].zones.center.damage = card.hp - 100;
    s.players[1].zones.back1 = unit('AUDIT-DUMMY');
    s = applyAction(s, 0, { ...attack }, pool, () => 0);
    assert.equal(s.players[1].zones.center, null, 'Buzz knockout resolves immediately after its two-Life loss');
    assert.equal(s.players[1].life.length, 3);
    assert.equal(s.lifeLosses.filter(loss => loss.ownerIndex === 1).length, 2);
  });

  test(`${runtime.name}: hEB01-016 stacks its printed White +50 independently of its three-underlay +50`, () => {
    const whiteTarget = cards.find(card => card.group === 'holomem' && card.colors.includes('白') && card.hp >= 200);
    assert.ok(whiteTarget, 'catalog must include a durable white Holomen for the printed target-color bonus');
    for (const { stack, target, expected } of [
      { stack: [inst('hEB01-011', 'under'), inst('hEB01-016', 'top')], target: 'AUDIT-DUMMY', expected: 40 },
      { stack: [inst('hEB01-011', 'under-1'), inst('hEB01-012', 'under-2'), inst('hEB01-016', 'top')], target: whiteTarget.number, expected: 90 },
      { stack: [inst('hEB01-011', 'under-1'), inst('hEB01-012', 'under-2'), inst('hEB01-013', 'under-3'), inst('hEB01-016', 'top')], target: 'AUDIT-DUMMY', expected: 90 },
      { stack: [inst('hEB01-011', 'under-1'), inst('hEB01-012', 'under-2'), inst('hEB01-013', 'under-3'), inst('hEB01-016', 'top')], target: whiteTarget.number, expected: 140 },
    ]) {
      let s = state('hEB01-016', target);
      s.players[0].zones.center.stack = stack;
      cheer(s.players[0].zones.center, ['hY01-001']);
      s = applyAction(s, 0, { ...attack }, pool, () => 0);
      assert.equal(s.players[1].zones.center.damage, expected);
    }
  });

  test(`${runtime.name}: hEB01-017 Bloom attaches an Archive Cheer; its Marine-only Arts threshold archives all underlays`, () => {
    const redTarget = cards.find(card => card.group === 'holomem' && card.colors.includes('紅') && card.hp >= 260);
    assert.ok(redTarget, 'catalog must include a red target that can survive the combined 250 damage');
    let bloom = state('hEB01-013');
    bloom.phase = 'main';
    bloom.players[0].hand = [inst('hEB01-017', 'marine-bloom')];
    bloom.players[0].archive = [inst('hY04-001', 'archive-cheer')];
    bloom = applyAction(bloom, 0, { type: 'play', cardId: 'marine-bloom' }, pool, () => 0);
    bloom = applyAction(bloom, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
    assert.equal(bloom.pendingChoice.optional, false);
    bloom = applyAction(bloom, 0, { type: 'choose', cardIds: ['archive-cheer'] }, pool, () => 0);
    bloom = applyAction(bloom, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
    assert.ok(bloom.players[0].zones.center.cheer.some(card => card.id === 'archive-cheer'));

    let s = state('hEB01-017');
    s.players[0].oshi = inst('hEB01-002', 'marine-oshi');
    s.players[0].zones.center.stack = [
      inst('hEB01-011', 'under-1'), inst('hEB01-012', 'under-2'), inst('hEB01-013', 'under-3'),
      inst('hEB01-014', 'under-4'), inst('hEB01-015', 'under-5'), inst('hEB01-017', 'marine-top'),
    ];
    cheer(s.players[0].zones.center, ['hY04-001', 'hY04-001', 'hY01-001', 'hY01-001']);
    s.players[1].zones.center = unit(redTarget.number, { stack: [inst(redTarget.number, 'red-defender')] });
    s.players[1].zones.back1 = unit('hEB01-013');
    s.players[1].zones.back2 = unit('hEB01-011');
    s = applyAction(s, 0, { ...attack }, pool, () => 0);
    assert.equal(s.pendingChoice.effect, 'artUnderCardCost');
    s = applyAction(s, 0, { type: 'choose', cardIds: ['under-1', 'under-2', 'under-3', 'under-4', 'under-5'] }, pool, () => 0);
    assert.equal(s.players[0].archive.filter(card => card.id.startsWith('under-')).length, 5);
    assert.equal(s.effectQueue.find(effect => effect.type === 'dealArtsDamage')?.damage, 250, '100 base +100 paid-underlay bonus +50 printed Red target bonus');
    assert.equal(s.players[1].zones.center.damage, 0, 'the Arts damage remains queued while the optional special-damage target is being chosen');
    assert.equal(s.pendingChoice.effect, 'specialDamage');
    assert.deepEqual(s.pendingChoice.options, ['back1'], 'the extra 100 targets only a non-Debut Back');
    s = applyAction(s, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
    assert.equal(s.players[1].zones.back1.damage, 100);
    assert.equal(s.players[1].zones.back2.damage, 0);
    assert.equal(s.players[1].zones.center.damage, 250, 'the queued Arts damage resolves after its special-damage choice');

    let withoutMarineOshi = state('hEB01-017');
    withoutMarineOshi.players[0].oshi = inst('hEB01-001', 'sora-oshi');
    withoutMarineOshi.players[0].zones.center.stack = [
      inst('hEB01-011', 'under-1'), inst('hEB01-012', 'under-2'), inst('hEB01-013', 'under-3'),
      inst('hEB01-014', 'under-4'), inst('hEB01-015', 'under-5'), inst('hEB01-017', 'marine-top'),
    ];
    cheer(withoutMarineOshi.players[0].zones.center, ['hY04-001', 'hY04-001', 'hY01-001', 'hY01-001']);
    withoutMarineOshi.players[1].zones.back1 = unit('hEB01-013');
    withoutMarineOshi = applyAction(withoutMarineOshi, 0, { ...attack }, pool, () => 0);
    assert.equal(withoutMarineOshi.players[1].zones.center.damage, 100, 'without Marine Oshi only the printed base Arts damage resolves');
    assert.equal(withoutMarineOshi.players[0].archive.length, 0, 'the Oshi-gated optional underlay cost is not offered');
    assert.equal(withoutMarineOshi.pendingChoice, null, 'no extra special-damage choice is created without Marine Oshi');
  });

  test(`${runtime.name}: hEB01-018 Arts checks #こよラボ attachment and its opponent-turn Gift returns one tagged Support`, () => {
    const koyoFan = cards.find(card => card.group === 'support' && card.typeCode === 'supportFan' && card.tags.includes('#こよラボ'));
    assert.ok(koyoFan);
    for (const [hasFan, expected] of [[false, 20], [true, 40]]) {
      let s = state('hEB01-018');
      if (hasFan) s.players[0].zones.center.attachments = [inst(koyoFan.number, 'koyo-fan')];
      cheer(s.players[0].zones.center, ['hY01-001']);
      s = applyAction(s, 0, { ...attack }, pool, () => 0);
      assert.equal(s.players[1].zones.center.damage, expected);
    }

    let s = state('AUDIT-DUMMY', 'hEB01-018');
    s.players[1].zones.center.attachments = [inst(koyoFan.number, 'returnable-koyo-fan')];
    s.players[1].zones.center.damage = 20;
    s.players[1].zones.back1 = unit('AUDIT-DUMMY');
    s = applyAction(s, 0, { ...attack }, pool, () => 0);
    assert.equal(s.players[1].life.length, 4);
    assert.equal(s.pendingChoice.effect, 'returnArchivedToHand', 'the opponent-turn Gift choice resolves before the queued life Cheer placement');
    assert.equal(s.pendingChoice.optional, true);
    s = applyAction(s, 1, { type: 'choose', cardIds: ['returnable-koyo-fan'] }, pool, () => 0);
    assert.ok(s.players[1].hand.some(card => card.id === 'returnable-koyo-fan'));
    assert.equal(s.pendingChoice.type, 'lifeCheerTarget');
    s = applyAction(s, 1, { type: 'choose', zone: 'back1' }, pool, () => 0);
    assert.ok(s.players[1].zones.back1.cheer.some(card => card.number === 'hY01-001'));
  });

  test(`${runtime.name}: hEB01-020 second Arts reveals by stage Cheer and scales by revealed Holomen`, () => {
    let s = state('hEB01-020');
    cheer(s.players[0].zones.center, ['hY06-001', 'hY01-001']);
    s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'revealed-holomem'), inst('hBP04-105', 'revealed-support'), inst('hEB01-018', 'remaining-holomem'), inst('hBP04-105', 'remaining-support')];
    s = applyAction(s, 0, { ...attack, artIndex: 1 }, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, 60, '50 base plus 10 for the one Holomen among exactly two revealed cards');
    assert.equal(s.players[0].mainDeck.length, 4);
    assert.deepEqual(new Set(s.players[0].mainDeck.map(card => card.id)), new Set(['revealed-holomem', 'revealed-support', 'remaining-holomem', 'remaining-support']));
  });
}
