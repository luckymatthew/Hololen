import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction, isActionCandidateLegal as websiteIsActionCandidateLegal } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, fund, attack } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, isActionCandidateLegal: websiteIsActionCandidateLegal, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const catalog = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, isActionCandidateLegal: engine.isActionCandidateLegal, cards: catalog });
}

for (const runtime of runtimes) {
  const { applyAction, isActionCandidateLegal, cards } = runtime;
  const pool = [...cards, dummy, oshi];
  const card = number => cards.find(candidate => candidate.number === number);
  const actAt = (battle, playerIndex, action) => applyAction(battle, playerIndex, action, pool, () => 0);
  const act = (battle, action) => actAt(battle, 0, action);
  const chooseAt = (battle, playerIndex, action) => actAt(battle, playerIndex, { type: 'choose', ...action });
  const choose = (battle, action) => chooseAt(battle, 0, action);
  const main = (source = 'hSD13-008', target = 'AUDIT-DUMMY') => { const battle = state(source, target); battle.phase = 'main'; return battle; };
  const performance = (source = 'hSD13-008', target = 'AUDIT-DUMMY') => { const battle = state(source, target); battle.phase = 'performance'; return battle; };

  test(`${runtime.name}: hSD13-016 can take any number of Justice cards and bottoms every other revealed card in the chosen order`, () => {
    const battle = main('hSD13-008');
    battle.players[0].hand = [inst('hSD13-016', 'justice-event')];
    battle.players[0].mainDeck = [
      inst('hSD13-008', 'justice-a'),
      inst('AUDIT-DUMMY', 'nonjustice-a'),
      inst('hSD13-013', 'justice-b'),
      inst('AUDIT-DUMMY', 'nonjustice-b'),
      inst('AUDIT-DUMMY', 'fifth-card'),
    ];

    let next = act(battle, { type: 'play', cardId: 'justice-event' });
    assert.equal(next.pendingChoice?.effect, 'topLookToHand');
    assert.equal(next.pendingChoice.min, 0);
    assert.equal(next.pendingChoice.max, 2);
    assert.deepEqual(next.pendingChoice.selectableIds, ['justice-a', 'justice-b']);

    next = choose(next, { cardIds: ['justice-a'] });
    assert.equal(next.pendingChoice?.effect, 'bottomOrder');
    next = choose(next, { cardIds: ['nonjustice-b', 'justice-b', 'nonjustice-a'] });
    assert.deepEqual(next.players[0].hand.map(instance => instance.id), ['justice-a']);
    assert.deepEqual(next.players[0].mainDeck.map(instance => instance.id), ['fifth-card', 'nonjustice-b', 'justice-b', 'nonjustice-a']);

    let decline = main('hSD13-008');
    decline.players[0].hand = [inst('hSD13-016', 'declined-event')];
    decline.players[0].mainDeck = [inst('hSD13-008', 'declined-justice'), inst('AUDIT-DUMMY', 'declined-other'), inst('hSD13-013', 'declined-justice-2'), inst('AUDIT-DUMMY', 'declined-other-2')];
    decline = act(decline, { type: 'play', cardId: 'declined-event' });
    decline = choose(decline, { cardIds: [] });
    assert.equal(decline.pendingChoice?.effect, 'bottomOrder', 'zero matching cards may be taken');
    decline = choose(decline, { cardIds: ['declined-justice', 'declined-other', 'declined-justice-2', 'declined-other-2'] });
    assert.deepEqual(decline.players[0].hand, []);
    assert.deepEqual(decline.players[0].mainDeck.map(instance => instance.id), ['declined-justice', 'declined-other', 'declined-justice-2', 'declined-other-2']);

    let noMatches = main('hSD13-008');
    noMatches.players[0].hand = [inst('hSD13-016', 'no-match-event')];
    noMatches.players[0].mainDeck = Array.from({ length: 4 }, (_, index) => inst('AUDIT-DUMMY', `no-match-${index}`));
    noMatches = act(noMatches, { type: 'play', cardId: 'no-match-event' });
    assert.equal(noMatches.pendingChoice?.effect, 'bottomOrder', 'when no Justice card is revealed, all four cards go directly to bottom ordering');
    noMatches = choose(noMatches, { cardIds: ['no-match-3', 'no-match-1', 'no-match-0', 'no-match-2'] });
    assert.deepEqual(noMatches.players[0].mainDeck.map(instance => instance.id), ['no-match-3', 'no-match-1', 'no-match-0', 'no-match-2']);
  });

  test(`${runtime.name}: hSD13-016 hand limit and LIMITED use are enforced before accepting another event`, () => {
    const atLimit = main('hSD13-008');
    atLimit.players[0].hand = [inst('hSD13-016', 'at-limit-event'), ...Array.from({ length: 6 }, (_, index) => inst('AUDIT-DUMMY', `at-limit-${index}`))];
    assert.equal(isActionCandidateLegal(atLimit, 0, { type: 'play', cardId: 'at-limit-event' }, pool), true);
    const overLimit = main('hSD13-008');
    overLimit.players[0].hand = [inst('hSD13-016', 'over-limit-event'), ...Array.from({ length: 7 }, (_, index) => inst('AUDIT-DUMMY', `over-limit-${index}`))];
    assert.equal(isActionCandidateLegal(overLimit, 0, { type: 'play', cardId: 'over-limit-event' }, pool), false);
    assert.throws(() => act(overLimit, { type: 'play', cardId: 'over-limit-event' }), /手牌不可多於 6 張/u);

    let limited = main('hSD13-008');
    limited.players[0].hand = [inst('hSD13-016', 'limited-first'), inst('hSD13-016', 'limited-second')];
    limited.players[0].mainDeck = [inst('hSD13-008', 'limited-top-1'), inst('hSD13-008', 'limited-top-2'), inst('hSD13-008', 'limited-top-3'), inst('hSD13-008', 'limited-top-4')];
    limited = act(limited, { type: 'play', cardId: 'limited-first' });
    limited = choose(limited, { cardIds: [] });
    limited = choose(limited, { cardIds: ['limited-top-1', 'limited-top-2', 'limited-top-3', 'limited-top-4'] });
    assert.equal(limited.players[0].limitedUsesCount, 1);
    assert.equal(isActionCandidateLegal(limited, 0, { type: 'play', cardId: 'limited-second' }, pool), false);
    assert.throws(() => act(limited, { type: 'play', cardId: 'limited-second' }), /LIMITED|每回合|本回合/u);
  });

  test(`${runtime.name}: hSD13-017 requires an all-Justice stage and offers only Holomen with undercards`, () => {
    const illegal = main('hSD13-013');
    illegal.players[0].zones.center = unit('hSD13-013', { stack: [inst('hSD13-008', 'illegal-under'), inst('hSD13-013', 'illegal-top')] });
    illegal.players[0].zones.back1 = unit('AUDIT-DUMMY');
    illegal.players[0].hand = [inst('hSD13-017', 'illegal-justice-event')];
    assert.throws(() => act(illegal, { type: 'play', cardId: 'illegal-justice-event' }), /所有 Holomen.*#Justice/u);
    assert.equal(illegal.players[0].hand[0].id, 'illegal-justice-event', 'illegal conditions do not consume the event');

    let valid = main('hSD13-013');
    valid.players[0].zones.center = unit('hSD13-013', { stack: [inst('hSD13-008', 'target-under-1'), inst('hSD13-011', 'target-under-2'), inst('hSD13-013', 'target-top')] });
    valid.players[0].zones.back1 = unit('hSD13-008', { stack: [inst('hSD13-008', 'no-under-top')] });
    valid.players[0].hand = [inst('hSD13-017', 'valid-justice-event')];
    valid = act(valid, { type: 'play', cardId: 'valid-justice-event' });
    assert.equal(valid.pendingChoice?.type, 'stageTarget');
    assert.deepEqual(valid.pendingChoice.options, ['center'], 'a Justice unit with no under-Holomen is not a target');
  });

  test(`${runtime.name}: hSD13-017 returns one or two under-Holomen and grants exactly +20 Arts per card this turn`, () => {
    const resolveAndAttack = (count, idSuffix) => {
      let battle = main('hSD13-013');
      battle.players[0].zones.center = unit('hSD13-013', { stack: [inst('hSD13-008', `${idSuffix}-under-1`), inst('hSD13-011', `${idSuffix}-under-2`), inst('hSD13-013', `${idSuffix}-top`)] });
      battle.players[0].hand = [inst('hSD13-017', `${idSuffix}-event`)];
      battle = act(battle, { type: 'play', cardId: `${idSuffix}-event` });
      battle = choose(battle, { zone: 'center' });
      const selected = battle.pendingChoice.cards.slice(0, count).map(instance => instance.id);
      battle = choose(battle, { cardIds: selected });
      assert.equal(battle.players[0].hand.length, count);
      assert.equal(battle.players[0].zones.center.stack.length, 3 - count);
      battle.phase = 'performance';
      fund(battle.players[0].zones.center, card('hSD13-013').arts[0].cost);
      battle = act(battle, attack);
      return battle;
    };

    const oneReturned = resolveAndAttack(1, 'one-return');
    assert.equal(oneReturned.players[1].zones.center.damage, 110, 'one returned Holomen adds 20 while one under-Holomen suppresses the printed +90 condition');
    const twoReturned = resolveAndAttack(2, 'two-return');
    assert.equal(twoReturned.players[1].zones.center.damage, 220, 'two returned Holomen add 40 and enable the printed no-under-Holomen +90');
  });

  test(`${runtime.name}: hSD13-017 is LIMITED once per turn after the first resolution`, () => {
    let battle = main('hSD13-013');
    battle.players[0].zones.center = unit('hSD13-013', { stack: [inst('hSD13-008', 'limited-under'), inst('hSD13-013', 'limited-top')] });
    battle.players[0].hand = [inst('hSD13-017', 'justice-once-1'), inst('hSD13-017', 'justice-once-2')];
    battle = act(battle, { type: 'play', cardId: 'justice-once-1' });
    battle = choose(battle, { zone: 'center' });
    battle = choose(battle, { cardIds: ['limited-under'] });
    assert.equal(battle.players[0].limitedUsesCount, 1);
    assert.equal(isActionCandidateLegal(battle, 0, { type: 'play', cardId: 'justice-once-2' }, pool), false);
    assert.throws(() => act(battle, { type: 'play', cardId: 'justice-once-2' }), /LIMITED|每回合|本回合/u);
  });

  test(`${runtime.name}: hSD13-018 grants +20 HP and only grants Gigi +20 Arts while she has no under-Holomen`, () => {
    const attachPopoToOpponent = () => {
      let battle = main('AUDIT-DUMMY', 'hSD13-008');
      battle.activePlayer = 1;
      battle.players[1].hand = [inst('hSD13-018', 'opponent-popo')];
      battle = actAt(battle, 1, { type: 'play', cardId: 'opponent-popo' });
      assert.equal(battle.pendingChoice?.type, 'attachSupport');
      battle = chooseAt(battle, 1, { zone: 'center' });
      battle.activePlayer = 0;
      battle.phase = 'performance';
      return battle;
    };
    let protectedGigi = attachPopoToOpponent();
    protectedGigi = act(protectedGigi, attack);
    assert.equal(protectedGigi.players[1].zones.center.damage, 100, '100 damage does not defeat 100 HP Gigi after Popo raises her to 120 HP');

    let control = performance('AUDIT-DUMMY', 'hSD13-008');
    control = act(control, attack);
    assert.equal(control.players[1].zones.center, null, 'the same 100 damage defeats Gigi without the +20 HP mascot');

    const gigiNoUnder = () => {
      let battle = main('hSD13-008');
      battle.players[0].hand = [inst('hSD13-018', 'gigi-popo')];
      battle = act(battle, { type: 'play', cardId: 'gigi-popo' });
      battle = choose(battle, { zone: 'center' });
      battle.phase = 'performance';
      fund(battle.players[0].zones.center, card('hSD13-008').arts[0].cost);
      return act(battle, attack);
    };
    const gigi = gigiNoUnder();
    assert.equal(gigi.players[1].zones.center.damage, 40, 'Gigi Debut base 20 becomes 40 from Popo');

    let stackedGigi = main('hSD13-011');
    stackedGigi.players[0].zones.center = unit('hSD13-011', { stack: [inst('hSD13-008', 'stacked-gigi-under'), inst('hSD13-011', 'stacked-gigi-top')] });
    stackedGigi.players[0].hand = [inst('hSD13-018', 'stacked-gigi-popo')];
    stackedGigi = act(stackedGigi, { type: 'play', cardId: 'stacked-gigi-popo' });
    stackedGigi = choose(stackedGigi, { zone: 'center' });
    stackedGigi.phase = 'performance';
    fund(stackedGigi.players[0].zones.center, card('hSD13-011').arts[0].cost);
    stackedGigi = act(stackedGigi, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(stackedGigi.players[1].zones.center.damage, 40, 'Popo does not grant Gigi Arts bonus while an under-Holomen remains');

    let nonGigi = main('hSD13-014');
    nonGigi.players[0].hand = [inst('hSD13-018', 'cecilia-popo')];
    nonGigi = act(nonGigi, { type: 'play', cardId: 'cecilia-popo' });
    nonGigi = choose(nonGigi, { zone: 'center' });
    nonGigi.phase = 'performance';
    fund(nonGigi.players[0].zones.center, card('hSD13-014').arts[0].cost);
    nonGigi = act(nonGigi, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(nonGigi.players[1].zones.center.damage, 40, 'Popo grants no conditional Arts bonus to Cecilia');
  });

  test(`${runtime.name}: hSD13-018 permits only one Popo per Holomen`, () => {
    let battle = main('hSD13-008');
    battle.players[0].zones.center = unit('hSD13-008', { attachments: [inst('hSD13-018', 'existing-popo')] });
    battle.players[0].zones.back1 = unit('hSD13-011');
    battle.players[0].hand = [inst('hSD13-018', 'second-popo')];
    battle = act(battle, { type: 'play', cardId: 'second-popo' });
    assert.deepEqual(battle.pendingChoice.options, ['back1']);
    assert.equal(isActionCandidateLegal(battle, 0, { type: 'choose', zone: 'center' }, pool), false);
    assert.throws(() => choose(battle, { zone: 'center' }), /不能附加該支援卡/u);
    battle = choose(battle, { zone: 'back1' });
    assert.deepEqual(battle.players[0].zones.center.attachments.map(instance => instance.number), ['hSD13-018']);
    assert.deepEqual(battle.players[0].zones.back1.attachments.map(instance => instance.number), ['hSD13-018']);
  });
}
