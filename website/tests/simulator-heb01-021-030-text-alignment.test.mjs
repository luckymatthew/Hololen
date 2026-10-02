import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, attack } from './fixtures/simulator-audit.mjs';

const tick = {
  number: 'AUDIT-TICK', name: 'One point audit tick', jpName: 'One point audit tick', group: 'holomem',
  stage: 'Debut', hp: 80, colors: [], tags: [], maxCopies: 4,
  arts: [{ name: 'Tick', damage: 1, cost: [], effect: '' }],
};
const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
// Use the actual shipped offline runtime catalog, whose printed icons were correct.
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/app/offline-cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const { applyAction: androidApplyAction } = await import(androidEngineUrl.href);
  const androidCards = JSON.parse(readFileSync(androidCardsUrl, 'utf8')).cards;
  runtimes.push({ name: 'Android source engine with shipped offline catalog', applyAction: androidApplyAction, cards: androidCards });
}
for (const runtime of runtimes) runtime.pool = [...runtime.cards, dummy, oshi, tick];

const cheer = (stageUnit, numbers) => { stageUnit.cheer = numbers.map((number, index) => inst(number, `cheer-${index}`)); };
const supportInHand = (s, number, id = 'event') => { s.players[0].hand = [inst(number, id)]; };
const play = (runtime, s, id = 'event') => runtime.applyAction(s, 0, { type: 'play', cardId: id }, runtime.pool, () => 0);

for (const runtime of runtimes) {
  const { applyAction, cards, pool } = runtime;

  test(`${runtime.name}: hEB01-021 basic Arts and Assistant-count Collab healing`, () => {
    let s = state('hEB01-021');
    cheer(s.players[0].zones.center, ['hY01-001']);
    s = applyAction(s, 0, attack, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, 30);

    s = state();
    s.phase = 'main';
    s.players[0].zones.back1 = unit('hEB01-021');
    s.players[0].zones.center.damage = 40;
    s.players[0].zones.back2 = unit('AUDIT-DUMMY', { damage: 30, attachments: [inst('hBP04-105', 'assistant-1')] });
    s.players[0].zones.center.attachments = [inst('hBP04-105', 'assistant-2')];
    s = applyAction(s, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(s.pendingChoice?.type, 'healDistribution');
    assert.equal(s.pendingChoice.count, 2);
    s = applyAction(s, 0, { type: 'choose', allocations: { center: 1, back2: 1 } }, pool, () => 0);
    assert.equal(s.players[0].zones.center.damage, 20);
    assert.equal(s.players[0].zones.back2.damage, 10);
  });

  test(`${runtime.name}: hEB01-022 second-stage Arts bonus and optional 1–2 Assistant Bloom return`, () => {
    for (const [has2nd, expected] of [[false, 30], [true, 50]]) {
      let s = state('hEB01-022');
      cheer(s.players[0].zones.center, ['hY06-001']);
      if (has2nd) s.players[0].zones.back1 = unit('hEB01-024');
      s = applyAction(s, 0, attack, pool, () => 0);
      assert.equal(s.players[1].zones.center.damage, expected);
    }

    let s = state('hEB01-021');
    s.phase = 'main';
    supportInHand(s, 'hEB01-022', 'bloom');
    s.players[0].archive = [inst('hBP04-105', 'assistant-a'), inst('hBP04-105', 'assistant-b'), inst('hBP04-105', 'assistant-c')];
    s = play(runtime, s, 'bloom');
    s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
    assert.equal(s.pendingChoice.effect, 'archiveAssistants');
    assert.equal(s.pendingChoice.optional, true);
    assert.equal(s.pendingChoice.max, 2);
    s = applyAction(s, 0, { type: 'choose', cardIds: ['assistant-a', 'assistant-b'] }, pool, () => 0);
    assert.deepEqual(new Set(s.players[0].hand.map(card => card.id)), new Set(['assistant-a', 'assistant-b']));
    assert.equal(s.players[0].archive.some(card => card.id === 'assistant-c'), true);
  });

  test(`${runtime.name}: hEB01-023 draws only to Assistant count, keeps its printed White +50, and bottoms up to four Koyori`, () => {
    const whiteTarget = cards.find(card => card.group === 'holomem' && card.colors.includes('白') && card.hp >= 200);
    assert.ok(whiteTarget);
    const sourceCard = cards.find(card => card.number === 'hEB01-023');
    assert.deepEqual(sourceCard.arts[0].specialTargets, ['白'], 'official printed icon supplies White +50 independently of effect prose');
    assert.deepEqual(sourceCard.arts[0].specialValues, [50]);

    let s = state('hEB01-023', whiteTarget.number);
    cheer(s.players[0].zones.center, ['hY01-001', 'hY01-001']);
    s.players[0].zones.center.attachments = [inst('hBP04-105', 'assistant-1'), inst('hBP04-105', 'assistant-2')];
    s.players[0].zones.back1 = unit('AUDIT-DUMMY', { attachments: [inst('hBP04-105', 'assistant-3')] });
    s.players[0].hand = [inst('AUDIT-DUMMY', 'already-held')];
    s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'draw-1'), inst('AUDIT-DUMMY', 'draw-2'), inst('AUDIT-DUMMY', 'draw-3')];
    s = applyAction(s, 0, attack, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, 100, '50 base +50 printed White target bonus');
    assert.equal(s.players[0].hand.length, 3, 'draw only until the three Assistant cards and hand size match');

    const labSupport = cards.find(card => card.group === 'support' && card.tags.includes('#こよラボ'));
    assert.ok(labSupport);
    let bloom = state('hEB01-022');
    bloom.phase = 'main';
    supportInHand(bloom, 'hEB01-023', 'koyori-bloom');
    const koyoris = ['koyori-1', 'koyori-2', 'koyori-3', 'koyori-4'].map(id => inst('hEB01-021', id));
    bloom.players[0].archive = [...koyoris, inst(labSupport.number, 'lab-support')];
    bloom = play(runtime, bloom, 'koyori-bloom');
    bloom = applyAction(bloom, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
    assert.equal(bloom.pendingChoice.effect, 'koyoriBottom');
    bloom = applyAction(bloom, 0, { type: 'choose', cardIds: koyoris.map(card => card.id) }, pool, () => 0);
    assert.equal(bloom.pendingChoice.effect, 'chooseArchiveSupportForAttach');
    bloom = applyAction(bloom, 0, { type: 'choose', cardIds: ['lab-support'] }, pool, () => 0);
    assert.equal(bloom.pendingChoice.type, 'attachArchivedSupport');
    bloom = applyAction(bloom, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
    assert.deepEqual(bloom.players[0].mainDeck.slice(-4).map(card => card.id), koyoris.map(card => card.id));
    assert.ok(bloom.players[0].zones.center.attachments.some(card => card.id === 'lab-support'));
  });

  test(`${runtime.name}: hEB01-024 Assistant Gift reduces one colorless cost and applies HP per Assistant; Arts keeps its printed White +50`, () => {
    const whiteTarget = cards.find(card => card.group === 'holomem' && card.colors.includes('白') && card.hp >= 200);
    const sourceCard = cards.find(card => card.number === 'hEB01-024');
    assert.deepEqual(sourceCard.arts[0].specialTargets, ['白'], 'official printed icon supplies White +50 independently of effect prose');
    assert.deepEqual(sourceCard.arts[0].specialValues, [50]);
    let s = state('hEB01-024', whiteTarget.number);
    // Printed cost is Yellow + 2 Colorless; one Assistant reduces only a Colorless requirement.
    cheer(s.players[0].zones.center, ['hY06-001', 'hY01-001']);
    s.players[0].zones.center.attachments = [inst('hBP04-105', 'gift-assistant')];
    s.players[0].zones.center.damage = 100;
    s.players[0].zones.back1 = unit('AUDIT-DUMMY', { damage: 30 });
    s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'revealed-holomem'), inst('hBP04-105', 'revealed-support')];
    s = applyAction(s, 0, attack, pool, () => 0);
    assert.equal(s.pendingChoice?.type, 'healDistribution');
    assert.equal(s.pendingChoice.count, 1);
    s = applyAction(s, 0, { type: 'choose', allocations: { back1: 1 } }, pool, () => 0);
    assert.equal(s.players[0].zones.back1.damage, 10);
    assert.equal(s.players[1].zones.center.damage, 190, '120 base +20 revealed Holomen +50 printed White target bonus');

    const withGift = (assistants) => {
      let incoming = state('AUDIT-TICK', 'hEB01-024');
      incoming.players[1].zones.center.damage = 200;
      incoming.players[1].zones.center.attachments = Array.from({ length: assistants }, (_, i) => inst('hBP04-105', `hp-assistant-${i}`));
      return applyAction(incoming, 0, attack, pool, () => 0);
    };
    assert.equal(withGift(0).players[1].zones.center, null, 'base 200 HP is exhausted by the one-point hit');
    assert.ok(withGift(1).players[1].zones.center, 'one named Assistant grants +10 HP, so the one-point hit does not knock it out');
  });

  test(`${runtime.name}: hEB01-025 Summer Computer uses the Life 2+ stage branch and Life 1 hand branch`, () => {
    const debut = cards.find(card => card.group === 'holomem' && card.stage === 'Debut' && card.tags.includes('#サマー'));
    const summerHolomem = cards.find(card => card.group === 'holomem' && card.tags.includes('#サマー'));
    assert.ok(debut && summerHolomem);
    let s = state(); s.phase = 'main'; s.players[0].life = s.players[0].life.slice(0, 2);
    supportInHand(s, 'hEB01-025'); s.players[0].mainDeck = [inst(debut.number, 'summer-debut'), inst('AUDIT-DUMMY', 'after-search')];
    s = play(runtime, s);
    assert.equal(s.pendingChoice?.type, 'cardSelection');
    assert.equal(s.pendingChoice.source, 'deck');
    assert.equal(s.pendingChoice.cards[0].id, 'summer-debut');
    s = applyAction(s, 0, { type: 'choose', cardIds: ['summer-debut'] }, pool, () => 0);
    assert.equal(s.pendingChoice.type, 'stageTarget');
    s = applyAction(s, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
    assert.equal(s.players[0].zones.back1.stack.at(-1).number, debut.number);
    assert.equal(s.players[0].mainDeck.at(-1).id, 'after-search');

    let low = state(); low.phase = 'main'; low.players[0].life = [inst('hY01-001', 'last-life')];
    supportInHand(low, 'hEB01-025'); low.players[0].mainDeck = [inst(summerHolomem.number, 'summer-in-hand'), inst('AUDIT-DUMMY', 'after-hand-search')];
    low = play(runtime, low);
    assert.equal(low.pendingChoice?.type, 'cardSelection');
    low = applyAction(low, 0, { type: 'choose', cardIds: ['summer-in-hand'] }, pool, () => 0);
    assert.ok(low.players[0].hand.some(card => card.id === 'summer-in-hand'));
    assert.equal(low.players[0].mainDeck.at(-1).id, 'after-hand-search');
  });

  test(`${runtime.name}: hEB01-026 requires Marine Oshi, draws two, then optionally bottoms a Marine and draws two more`, () => {
    let s = state(); s.phase = 'main'; s.players[0].oshi = inst('hEB01-002', 'marine-oshi');
    supportInHand(s, 'hEB01-026'); s.players[0].hand.push(inst('hEB01-011', 'marine-card'));
    s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'draw-1'), inst('AUDIT-DUMMY', 'draw-2'), inst('AUDIT-DUMMY', 'draw-3'), inst('AUDIT-DUMMY', 'draw-4')];
    s = play(runtime, s);
    assert.equal(s.players[0].hand.length, 3);
    assert.equal(s.pendingChoice?.effect, 'kumarineBottom');
    assert.equal(s.pendingChoice.optional, true);
    s = applyAction(s, 0, { type: 'choose', cardIds: ['marine-card'] }, pool, () => 0);
    assert.deepEqual(s.players[0].mainDeck.map(card => card.id), ['marine-card']);
    assert.ok(s.players[0].hand.some(card => card.id === 'draw-3'));
    assert.ok(s.players[0].hand.some(card => card.id === 'draw-4'));
    assert.equal(s.players[0].hand.length, 4);
    assert.throws(() => {
      let invalid = state(); invalid.phase = 'main'; supportInHand(invalid, 'hEB01-026');
      play(runtime, invalid);
    }, /推し Holomen 必須/u);
  });

  test(`${runtime.name}: hEB01-027 boosts every Summer Holomen and attaches an archived Cheer`, () => {
    const summer = cards.find(card => card.group === 'holomem' && card.tags.includes('#サマー'));
    assert.ok(summer);
    let s = state(); s.phase = 'main';
    s.players[0].zones.center = unit(summer.number);
    s.players[0].zones.back1 = unit('AUDIT-DUMMY');
    s.players[0].archive = [inst('hY01-001', 'archived-cheer')];
    supportInHand(s, 'hEB01-027'); s = play(runtime, s);
    assert.ok(s.players[0].modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 30 && modifier.rule?.tags?.includes('#サマー')));
    assert.equal(s.pendingChoice?.type, 'cardSelection');
    assert.equal(s.pendingChoice.cards[0].id, 'archived-cheer');
    s = applyAction(s, 0, { type: 'choose', cardIds: ['archived-cheer'] }, pool, () => 0);
    assert.equal(s.pendingChoice.effect, 'attachArchiveCheer');
    s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
    assert.ok(s.players[0].zones.center.cheer.some(card => card.id === 'archived-cheer'));
  });

  test(`${runtime.name}: hEB01-028 selects only a 2nd Holomen and grants Arts +30 plus two-card knockout draw`, () => {
    let s = state(); s.phase = 'main';
    s.players[0].zones.center = unit('hEB01-023');
    s.players[0].zones.back1 = unit('hEB01-021');
    s.players[1].zones.center = unit('AUDIT-TICK');
    s.players[1].zones.back1 = unit('AUDIT-DUMMY');
    supportInHand(s, 'hEB01-028'); s = play(runtime, s);
    assert.deepEqual(s.pendingChoice?.options, ['center']);
    s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
    assert.ok(s.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 30));
    assert.ok(s.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'drawOnArtsKnockout' && modifier.amount === 2));
    cheer(s.players[0].zones.center, ['hY01-001', 'hY01-001']);
    s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'knockout-draw-1'), inst('AUDIT-DUMMY', 'knockout-draw-2')];
    s.phase = 'performance';
    s = applyAction(s, 0, { ...attack, sourceZone: 'center', targetZone: 'center' }, pool, () => 0);
    assert.equal(s.players[1].zones.center, null);
    assert.deepEqual(s.players[0].hand.map(card => card.id), ['knockout-draw-1', 'knockout-draw-2']);
  });

  test(`${runtime.name}: hEB01-029 requires Summer Center and Collab, deals 30 special damage once per turn`, () => {
    const summer = cards.find(card => card.group === 'holomem' && card.tags.includes('#サマー'));
    assert.ok(summer);
    let invalid = state(); invalid.phase = 'main'; invalid.players[0].zones.center = unit(summer.number); invalid.players[0].zones.collab = unit('AUDIT-DUMMY'); supportInHand(invalid, 'hEB01-029');
    assert.throws(() => play(runtime, invalid), /中央及合作 Holomen 都必須持有 #サマー/u);

    let s = state(); s.phase = 'main'; s.players[0].zones.center = unit(summer.number); s.players[0].zones.collab = unit(summer.number);
    s.players[1].zones.center = unit('AUDIT-TICK'); s.players[1].zones.collab = unit('AUDIT-DUMMY');
    supportInHand(s, 'hEB01-029', 'splash-1'); s.players[0].hand.push(inst('hEB01-029', 'splash-2'));
    s = play(runtime, s, 'splash-1');
    assert.deepEqual(s.pendingChoice?.options, ['center', 'collab']);
    s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, 30);
    assert.throws(() => play(runtime, s, 'splash-2'), /本回合已使用過/u);
  });

  test(`${runtime.name}: hEB01-030 draws two first; at three Summer Holomen it picks one of the next two and archives the rest`, () => {
    const summer = cards.find(card => card.group === 'holomem' && card.tags.includes('#サマー'));
    assert.ok(summer);
    let s = state(); s.phase = 'main';
    s.players[0].zones.center = unit(summer.number);
    s.players[0].zones.back1 = unit(summer.number);
    s.players[0].zones.back2 = unit(summer.number);
    s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'draw-1'), inst('AUDIT-DUMMY', 'draw-2'), inst('AUDIT-DUMMY', 'look-1'), inst('AUDIT-DUMMY', 'look-2')];
    supportInHand(s, 'hEB01-030'); s = play(runtime, s);
    assert.equal(s.players[0].hand.length, 2);
    assert.equal(s.pendingChoice?.min, 1);
    assert.equal(s.pendingChoice?.max, 1);
    assert.deepEqual(s.pendingChoice.cards.map(card => card.id), ['look-1', 'look-2']);
    s = applyAction(s, 0, { type: 'choose', cardIds: ['look-2'] }, pool, () => 0);
    assert.ok(s.players[0].hand.some(card => card.id === 'look-2'));
    assert.ok(s.players[0].archive.some(card => card.id === 'look-1'));

    let below = state(); below.phase = 'main'; below.players[0].zones.center = unit(summer.number); below.players[0].zones.back1 = unit(summer.number);
    below.players[0].mainDeck = [inst('AUDIT-DUMMY', 'below-1'), inst('AUDIT-DUMMY', 'below-2'), inst('AUDIT-DUMMY', 'remaining')];
    supportInHand(below, 'hEB01-030'); below = play(runtime, below);
    assert.equal(below.players[0].hand.length, 2);
    assert.equal(below.pendingChoice, null, 'two Summer Holomen do not enable the extra look');
    assert.deepEqual(below.players[0].mainDeck.map(card => card.id), ['remaining']);
  });
}
