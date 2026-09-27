import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, attack } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const { applyAction: androidApplyAction } = await import(androidEngineUrl.href);
  const androidCards = JSON.parse(readFileSync(androidCardsUrl, 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: androidApplyAction, cards: androidCards });
}
for (const runtime of runtimes) runtime.pool = [...runtime.cards, dummy, oshi];

const cheer = (unitState, numbers) => { unitState.cheer = numbers.map((number, index) => inst(number, `cheer-${index}`)); };

for (const runtime of runtimes) {
  const { applyAction, cards, pool } = runtime;

  test(`${runtime.name}: hEB01-004/005/007/008 basic Arts pay printed Cheer and deal printed damage`, () => {
    for (const entry of [
      { number: 'hEB01-004', damage: 20, colors: ['hY03-001'] },
      { number: 'hEB01-005', damage: 30, colors: ['hY01-001'] },
      { number: 'hEB01-007', damage: 30, colors: ['hY01-001'] },
      { number: 'hEB01-008', damage: 70, colors: ['hY03-001', 'hY03-001'] },
    ]) {
      let s = state(entry.number);
      cheer(s.players[0].zones.center, entry.colors);
      s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'top')];
      s = applyAction(s, 0, { ...attack }, pool, () => 0);
      assert.equal(s.players[1].zones.center.damage, entry.damage, `${entry.number} base Art damage`);
    }
  });

  test(`${runtime.name}: hEB01-004 Arts draws exactly one card`, () => {
    let s = state('hEB01-004');
    cheer(s.players[0].zones.center, ['hY03-001']);
    s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'drawn'), inst('AUDIT-DUMMY', 'remain')];
    s = applyAction(s, 0, { ...attack }, pool, () => 0);
    assert.deepEqual(s.players[0].hand.map(card => card.id), ['drawn']);
    assert.deepEqual(s.players[0].mainDeck.map(card => card.id), ['remain']);
  });

  test(`${runtime.name}: hEB01-005 first-second-turn Collab deploys three unlimited Sora Debuts and bottoms a hand card`, () => {
    const soraDebut = cards.find(card => card.jpName === 'ときのそら' && card.stage === 'Debut' && card.unlimited);
    assert.ok(soraDebut, 'catalog must include the unlimited Sora Debut referenced by the effect');
    let s = state();
    s.phase = 'main';
    s.firstPlayer = 1;
    s.players[0].turnsTaken = 1;
    s.players[0].zones.back1 = unit('hEB01-005');
    s.players[0].hand = [inst('AUDIT-DUMMY', 'bottom-me')];
    s.players[0].mainDeck = [inst('hY01-001', 'collab-power'), ...[1, 2, 3].map(index => inst(soraDebut.number, `sora-${index}`)), inst('AUDIT-DUMMY', 'remaining')];
    s = applyAction(s, 0, { type: 'collab', zone: 'back1' }, pool, () => 0.5);
    assert.equal(s.pendingChoice.effect, 'deckCardsToStage');
    assert.equal(s.pendingChoice.optional, false);
    assert.equal(s.pendingChoice.min, 0, 'the local mandatory-selection contract exposes min=0 but rejects skipping');
    assert.equal(s.pendingChoice.max, 3);
    assert.throws(() => applyAction(s, 0, { type: 'choose', skip: true }, pool, () => 0.5));
    s = applyAction(s, 0, { type: 'choose', cardIds: ['sora-1', 'sora-2', 'sora-3'] }, pool, () => 0.5);
    for (const zone of ['back1', 'back2', 'back3']) s = applyAction(s, 0, { type: 'choose', zone }, pool, () => 0.5);
    assert.equal(s.pendingChoice.effect, 'handToBottom');
    s = applyAction(s, 0, { type: 'choose', cardIds: ['bottom-me'] }, pool, () => 0.5);
    assert.equal(s.players[0].holoPower[0].id, 'collab-power');
    assert.deepEqual(['back1', 'back2', 'back3'].map(zone => s.players[0].zones[zone].stack.at(-1).id), ['sora-1', 'sora-2', 'sora-3']);
    assert.equal(s.players[0].mainDeck.at(-1).id, 'bottom-me');
  });

  test(`${runtime.name}: hEB01-006 Arts gains 30 only against 1st-or-higher and its opponent-turn Gift returns one attached Support`, () => {
    for (const [targetNumber, expectedDamage] of [['hEB01-013', 80], ['hEB01-004', 50]]) {
      let s = state('hEB01-006', targetNumber);
      cheer(s.players[0].zones.center, ['hY03-001', 'hY01-001']);
      s = applyAction(s, 0, { ...attack }, pool, () => 0);
      assert.equal(s.players[1].zones.center.damage, expectedDamage, `${targetNumber} target-stage condition`);
    }

    let s = state('AUDIT-DUMMY', 'hEB01-006');
    s.players[1].zones.center.damage = 9990;
    s.players[1].zones.center.attachments = [inst('hBP04-105', 'gift-support')];
    s.players[1].zones.back1 = unit('AUDIT-DUMMY');
    s = applyAction(s, 0, { ...attack }, pool, () => 0);
    assert.equal(s.players[1].zones.center.downPending, true);
    assert.equal(s.pendingChoice.effect, 'archiveToHand');
    assert.equal(s.pendingChoice.optional, true);
    s = applyAction(s, 1, { type: 'choose', cardIds: ['gift-support'] }, pool, () => 0);
    assert.ok(s.players[1].hand.some(card => card.id === 'gift-support'));
  });

  test(`${runtime.name}: hEB01-007 Bloom draws first then requires one hand card on the deck bottom`, () => {
    let s = state('hEB01-004');
    s.phase = 'main';
    s.players[0].hand = [inst('hEB01-007', 'bloom'), inst('AUDIT-DUMMY', 'keep')];
    s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'drawn')];
    s = applyAction(s, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
    s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
    assert.deepEqual(s.players[0].hand.map(card => card.id), ['keep', 'drawn']);
    assert.equal(s.pendingChoice.effect, 'handToBottom');
    assert.equal(s.pendingChoice.optional, false);
    s = applyAction(s, 0, { type: 'choose', cardIds: ['keep'] }, pool, () => 0);
    assert.equal(s.players[0].mainDeck.at(-1).id, 'keep');
  });

  test(`${runtime.name}: hEB01-008 Bloom searches STAR STAR☆T and hEB01-009 Collab searches a 2nd Sora`, () => {
    const star = cards.find(card => card.jpName === 'STAR STAR☆T');
    assert.ok(star, 'catalog must include STAR STAR☆T');
    let s = state('hEB01-004');
    s.phase = 'main';
    s.players[0].hand = [inst('hEB01-008', 'sora-bloom')];
    s.players[0].mainDeck = [inst(star.number, 'star-search'), inst('AUDIT-DUMMY', 'remain')];
    s = applyAction(s, 0, { type: 'play', cardId: 'sora-bloom' }, pool, () => 0);
    s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
    assert.ok(s.pendingChoice, 'Bloom must open its required deck search');
    assert.equal(s.pendingChoice.optional, false);
    s = applyAction(s, 0, { type: 'choose', cardIds: ['star-search'] }, pool, () => 0);
    assert.ok(s.players[0].hand.some(card => card.id === 'star-search'));

    const sora2nd = cards.find(card => card.jpName === 'ときのそら' && card.stage === '2nd');
    assert.ok(sora2nd, 'catalog must include a 2nd Sora');
    s = state();
    s.phase = 'main';
    s.players[0].zones.back1 = unit('hEB01-009');
    s.players[0].mainDeck = [inst('hY01-001', 'collab-power'), inst(sora2nd.number, 'sora-search'), inst('AUDIT-DUMMY', 'remain')];
    s = applyAction(s, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.ok(s.pendingChoice, 'Collab must open its required deck search');
    assert.equal(s.pendingChoice.optional, false);
    s = applyAction(s, 0, { type: 'choose', cardIds: ['sora-search'] }, pool, () => 0);
    assert.ok(s.players[0].hand.some(card => card.id === 'sora-search'));
    assert.ok(s.players[0].holoPower.some(card => card.id === 'collab-power'));
  });

  test(`${runtime.name}: hEB01-009 Arts returns 1–3 archived Holomen then draws one`, () => {
    let s = state('hEB01-009');
    cheer(s.players[0].zones.center, ['hY03-001', 'hY01-001']);
    s.players[0].archive = [inst('hEB01-004', 'return-one'), inst('hEB01-005', 'return-two')];
    s.players[0].mainDeck = [inst('AUDIT-DUMMY', 'draw-after-shuffle')];
    s = applyAction(s, 0, { ...attack }, pool, () => 0);
    assert.equal(s.pendingChoice.effect, 'artArchiveHolomemShuffleDraw');
    assert.equal(s.pendingChoice.min, 1);
    assert.equal(s.pendingChoice.max, 2);
    assert.equal(s.pendingChoice.optional, false);
    s = applyAction(s, 0, { type: 'choose', cardIds: ['return-one'] }, pool, () => 0);
    assert.equal(s.players[0].hand.length, 1);
    assert.equal(s.players[0].archive.length, 1);
    assert.ok([...s.players[0].mainDeck, ...s.players[0].hand].some(card => card.id === 'return-one'));
  });

  test(`${runtime.name}: hEB01-010 Center Bloom's optional odd roll swaps opponent Center with a Back; even roll leaves them`, () => {
    for (const [roll, swaps] of [[0, true], [0.2, false]]) {
      let s = state('hEB01-007');
      s.phase = 'main';
      s.players[0].hand = [inst('hEB01-010', 'summer-bloom')];
      s.players[1].zones.center = unit('AUDIT-DUMMY', { stack: [inst('AUDIT-DUMMY', 'enemy-center')] });
      s.players[1].zones.back1 = unit('AUDIT-DUMMY', { stack: [inst('AUDIT-DUMMY', 'enemy-back')] });
      s = applyAction(s, 0, { type: 'play', cardId: 'summer-bloom' }, pool, () => 0);
      s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
      assert.equal(s.pendingChoice.effect, 'soraSummerRoll');
      assert.equal(s.pendingChoice.optional, true);
      s = applyAction(s, 0, { type: 'choose', optionId: 'roll' }, pool, () => roll);
      if (swaps) {
        assert.equal(s.pendingChoice.effect, 'swapCenter');
        assert.equal(s.pendingChoice.optional, false);
        s = applyAction(s, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
        assert.equal(s.players[1].zones.center.stack[0].id, 'enemy-back');
        assert.equal(s.players[1].zones.back1.stack[0].id, 'enemy-center');
      } else {
        assert.equal(s.pendingChoice, null);
        assert.equal(s.players[1].zones.center.stack[0].id, 'enemy-center');
        assert.equal(s.players[1].zones.back1.stack[0].id, 'enemy-back');
      }
    }

    let backBloom = state('hEB01-007');
    backBloom.phase = 'main';
    backBloom.players[0].hand = [inst('hEB01-010', 'back-summer-bloom')];
    backBloom.players[0].zones.back1 = unit('hEB01-007');
    backBloom = applyAction(backBloom, 0, { type: 'play', cardId: 'back-summer-bloom' }, pool, () => 0);
    backBloom = applyAction(backBloom, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
    assert.equal(backBloom.pendingChoice, null, 'the [Center only] Bloom skill does not trigger when it enters Back');
  });

  test(`${runtime.name}: hEB01-010 Arts pays by resting an active Back 2nd Sora and can then repeat only that Arts`, () => {
    let s = state('hEB01-010');
    cheer(s.players[0].zones.center, ['hY03-001', 'hY01-001', 'hY02-001']);
    s.players[0].zones.back1 = unit('hEB01-009');
    s = applyAction(s, 0, { ...attack }, pool, () => 0);
    assert.equal(s.pendingChoice.effect, 'artRestBackRepeat');
    assert.equal(s.pendingChoice.optional, true);
    s = applyAction(s, 0, { type: 'choose', zone: 'back1' }, pool, () => 0);
    assert.equal(s.players[0].zones.back1.rested, true);
    assert.equal(s.players[1].zones.center.damage, 100);
    s = applyAction(s, 0, { ...attack }, pool, () => 0);
    assert.equal(s.players[1].zones.center.damage, 200);
    assert.equal(s.players[0].turnEvents.arts.length, 2);
  });
}
