import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, fund, inst, state, unit } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const cards = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, cards });
}

for (const runtime of runtimes) {
  const { applyAction, cards } = runtime;
  const card = number => cards.find(candidate => candidate.number === number);
  const riona = card('hSD10-010');
  const qualifyingSecond = card('hSD10-006');
  const nonQualifyingDebut = card('hSD10-007');
  const nonQualifyingSecond = card('hBP01-014');
  const pool = [...cards, dummy];

  test(`${runtime.name}: hSD10-010 Arts gets +30 only while own stage has a #FLOW GLOW 2nd-or-higher Holomem`, () => {
    assert.equal(riona.arts[0].damage, 50);
    assert.match(riona.arts[0].effect, /#FLOW GLOW.*2nd以上/u);
    const attack = backCard => {
      const battle = state(riona.number);
      battle.players[0].zones.back1 = unit(backCard.number);
      battle.players[1].zones.center = unit(dummy.number);
      fund(battle.players[0].zones.center, riona.arts[0].cost);
      return applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    };

    const qualifying = attack(qualifyingSecond);
    const wrongStage = attack(nonQualifyingDebut);
    const wrongTag = attack(nonQualifyingSecond);
    assert.equal(qualifying.players[1].zones.center.damage, 80);
    assert.equal(wrongStage.players[1].zones.center.damage, 50);
    assert.equal(wrongTag.players[1].zones.center.damage, 50);
  });

  test(`${runtime.name}: hSD10-010 Spot cannot be used as a Bloom base`, () => {
    let battle = state(riona.number);
    battle.phase = 'main';
    battle.players[0].hand = [inst(qualifyingSecond.number, 'bloom')];
    assert.throws(() => applyAction(battle, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0));
  });

  test(`${runtime.name}: hSD10-010 Collab archives an optional hand cost before searching the conjunctive filter`, () => {
    const valid = card('hSD10-008');
    const tagOnly = card('hSD10-007');
    const collabOnly = cards.find(candidate => candidate.group === 'holomem'
      && ['collab', 'collab_effect'].includes(candidate.keyword?.type)
      && !candidate.tags?.includes('#FLOW GLOW'));
    assert.ok(valid && tagOnly && collabOnly);

    const begin = () => {
      const battle = state();
      battle.phase = 'main';
      battle.players[0].zones.back1 = unit(riona.number);
      battle.players[0].hand = [inst('hSD10-002', 'cost')];
      battle.players[0].mainDeck = [inst(dummy.number, 'collab-power'), inst(valid.number, 'valid'), inst(tagOnly.number, 'tag-only'), inst(collabOnly.number, 'collab-only')];
      return battle;
    };
    const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);

    let paid = applyAction(begin(), 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.deepEqual(paid.players[0].holoPower.map(instance => instance.id), ['collab-power']);
    assert.equal(paid.pendingChoice?.effect, 'genericKeywordHandArchiveCost');
    assert.equal(paid.pendingChoice.optional, true);
    paid = choose(paid, { cardIds: ['cost'] });
    assert.deepEqual(paid.players[0].archive.map(instance => instance.id), ['cost']);
    assert.equal(paid.pendingChoice?.effect, 'deckToHandShuffle');
    assert.deepEqual(paid.pendingChoice.cards.map(instance => instance.id), ['valid']);
    paid = choose(paid, { cardIds: ['valid'] });
    assert.deepEqual(paid.players[0].hand.map(instance => instance.id), ['valid']);
    assert.deepEqual(new Set(paid.players[0].mainDeck.map(instance => instance.id)), new Set(['tag-only', 'collab-only']));

    let skipped = applyAction(begin(), 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    skipped = choose(skipped, { skip: true });
    assert.equal(skipped.pendingChoice, null);
    assert.equal(skipped.players[0].archive.some(instance => instance.id === 'cost'), false);
    assert.equal(skipped.players[0].hand.some(instance => instance.id === 'valid'), false);
    assert.ok(skipped.players[0].mainDeck.some(instance => instance.id === 'valid'));
  });

  test(`${runtime.name}: hSD10-011 requires an all-#FLOW GLOW stage and distributes exactly three Archive Cheer at two per Holomem`, () => {
    const fgCenter = card('hSD10-002');
    const fgCollab = card('hSD10-008');
    const begin = withOnlyFlowGlow => {
      const battle = state(fgCenter.number);
      battle.phase = 'main';
      battle.players[0].hand = [inst('hSD10-011', 'event')];
      battle.players[0].zones.collab = unit(withOnlyFlowGlow ? fgCollab.number : dummy.number);
      battle.players[0].archive = [inst('hY01-001', 'c0'), inst('hY02-001', 'c1'), inst('hY03-001', 'c2')];
      return battle;
    };
    const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);

    assert.throws(() => applyAction(begin(false), 0, { type: 'play', cardId: 'event' }, pool, () => 0));
    let battle = applyAction(begin(true), 0, { type: 'play', cardId: 'event' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'keepGrowingCheer');
    battle = choose(battle, { cardIds: ['c0', 'c1', 'c2'] });
    battle = choose(battle, { zone: 'center' });
    battle = choose(battle, { zone: 'center' });
    assert.deepEqual(battle.pendingChoice?.options, ['collab']);
    battle = choose(battle, { zone: 'collab' });
    assert.equal(battle.players[0].zones.center.cheer.length, 2);
    assert.equal(battle.players[0].zones.collab.cheer.length, 1);
    assert.equal(battle.players[0].archive.filter(instance => ['c0', 'c1', 'c2'].includes(instance.id)).length, 0);
  });

  test(`${runtime.name}: hSD10-012 checks six other hand cards and puts unselected top-four cards at deck bottom`, () => {
    const look = card('hSD10-012');
    const fgOne = card('hSD10-008');
    const fgTwo = card('hSD10-006');
    const fgThree = card('hSD10-007');
    const nonmatch = card('hBP01-014');
    const begin = extraCount => {
      const battle = state();
      battle.phase = 'main';
      battle.players[0].hand = [inst(look.number, 'look'), ...Array.from({ length: extraCount }, (_, index) => inst('hSD10-002', `extra-${index}`))];
      battle.players[0].mainDeck = [inst(fgOne.number, 'fg-one'), inst(nonmatch.number, 'nonmatch'), inst(fgTwo.number, 'fg-two'), inst(fgThree.number, 'fg-three'), inst(dummy.number, 'below-look')];
      return battle;
    };
    const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);

    let battle = applyAction(begin(6), 0, { type: 'play', cardId: 'look' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'topLookToHand');
    assert.deepEqual(new Set(battle.pendingChoice.selectableIds), new Set(['fg-one', 'fg-two', 'fg-three']));
    battle = choose(battle, { cardIds: ['fg-one', 'fg-two'] });
    assert.equal(battle.pendingChoice?.effect, 'bottomOrder');
    battle = choose(battle, { cardIds: ['nonmatch', 'fg-three'] });
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['below-look', 'nonmatch', 'fg-three']);
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'fg-one'));
    assert.throws(() => applyAction(begin(7), 0, { type: 'play', cardId: 'look' }, pool, () => 0));
  });

  test(`${runtime.name}: hSD10-013 can decline its End Phase trigger without losing the attached tool`, () => {
    const puffer = card('hSD10-013');
    const bloomSecond = card('hSD10-006');
    let battle = state();
    battle.players[0].zones.center = unit(bloomSecond.number, { attachments: [inst(puffer.number, 'fugu-tool')] });
    fund(battle.players[0].zones.center, bloomSecond.arts[0].cost);
    battle.players[1].zones.center = unit(dummy.number);
    battle.players[0].mainDeck = [inst('hSD10-007', 'candidate'), inst('hBP01-014', 'noncandidate')];
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    battle = applyAction(battle, 0, { type: 'advance' }, pool, () => 0);

    assert.equal(battle.pendingChoice?.effect, 'hSD10PufferActivate');
    battle = applyAction(battle, 0, { type: 'choose', skip: true }, pool, () => 0);
    assert.ok(battle.players[0].zones.center.attachments.some(instance => instance.id === 'fugu-tool'));
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['candidate', 'noncandidate']);
  });

  test(`${runtime.name}: hSD10-013 activated search stages one legal Holomem, shuffles, and bottoms the tool`, () => {
    const puffer = card('hSD10-013');
    const bloomSecond = card('hSD10-006');
    let battle = state();
    battle.players[0].zones.center = unit(bloomSecond.number, { attachments: [inst(puffer.number, 'fugu-tool')] });
    fund(battle.players[0].zones.center, bloomSecond.arts[0].cost);
    battle.players[1].zones.center = unit(dummy.number);
    battle.players[0].mainDeck = [inst('hSD10-007', 'candidate'), inst('hSD10-006', 'wrong-stage'), inst('hBP01-014', 'wrong-tag')];
    const choose = action => { battle = applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0); };

    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 90, 'the tool grants +10 Arts to its tagged Holomem');
    battle = applyAction(battle, 0, { type: 'advance' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'hSD10PufferActivate');
    choose({ optionId: 'activate' });
    assert.equal(battle.pendingChoice?.effect, 'deckCardsToStage');
    assert.equal(battle.pendingChoice.optional, false);
    assert.deepEqual(battle.pendingChoice.cards.map(instance => instance.id), ['candidate']);
    choose({ cardIds: ['candidate'] });
    assert.equal(battle.pendingChoice?.effect, 'placeCard');
    choose({ zone: 'back1' });
    assert.equal(battle.players[0].zones.back1.stack.at(-1).number, 'hSD10-007');
    assert.equal(battle.players[0].zones.center.attachments.some(instance => instance.id === 'fugu-tool'), false);
    assert.equal(battle.players[0].mainDeck.at(-1).id, 'fugu-tool');
    assert.ok(battle.players[0].mainDeck.some(instance => instance.id === 'wrong-stage'));
    assert.ok(battle.players[0].mainDeck.some(instance => instance.id === 'wrong-tag'));
  });

  test(`${runtime.name}: hSD10-013 does not grant its Arts bonus or End Phase trigger to a non-#FLOW GLOW Holomem`, () => {
    const puffer = card('hSD10-013');
    let battle = state();
    battle.players[0].zones.center = unit(dummy.number, { attachments: [inst(puffer.number, 'fugu-tool')] });
    battle.players[1].zones.center = unit(dummy.number);
    fund(battle.players[0].zones.center, dummy.arts[0].cost);
    battle.players[0].mainDeck = [inst('hSD10-007', 'candidate')];

    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, dummy.arts[0].damage);
    battle = applyAction(battle, 0, { type: 'advance' }, pool, () => 0);
    assert.equal(battle.pendingChoice, null);
    assert.ok(battle.players[0].zones.center.attachments.some(instance => instance.id === 'fugu-tool'));
  });
}
