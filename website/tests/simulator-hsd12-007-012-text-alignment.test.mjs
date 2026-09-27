import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, fund } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const catalog = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, cards: catalog });
}

for (const runtime of runtimes) {
  const { applyAction, cards } = runtime;
  const pool = [...cards, dummy, oshi];
  const card = number => cards.find(candidate => candidate.number === number);
  const act = (battle, action, playerIndex = 0) => applyAction(battle, playerIndex, action, pool, () => 0);
  const choose = (battle, action, playerIndex = 0) => act(battle, { type: 'choose', ...action }, playerIndex);
  const performance = source => { const battle = state(source); battle.phase = 'performance'; return battle; };
  const main = source => { const battle = state(source); battle.phase = 'main'; return battle; };

  test(`${runtime.name}: hSD12-007 Arts counts own Advent Holomen and excludes opposing Debut targets`, () => {
    const shiori = card('hSD12-007');
    let battle = performance(shiori.number);
    battle.players[0].zones.back1 = unit('hSD12-008');
    battle.players[1].zones.center = unit('hSD12-010');
    battle.players[1].zones.back1 = unit('hSD12-008');
    fund(battle.players[0].zones.center, shiori.arts[0].cost);

    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(battle.pendingChoice?.effect, 'specialDamage');
    assert.equal(battle.pendingChoice.meta.amount, 20, 'both own stage Advent Holomen count, including the Arts source');
    assert.deepEqual(battle.pendingChoice.options, ['center'], 'the opposing Debut Back is not a legal target');
    battle = choose(battle, { zone: 'center' });
    assert.equal(battle.players[1].zones.center.damage, 130, '110 Arts plus 20 special damage');
  });

  test(`${runtime.name}: hSD12-007 Gift returns one archived non-LIMITED Support after its knockout`, () => {
    const shiori = card('hSD12-007');
    const support = cards.find(candidate => candidate.group === 'support' && !String(candidate.type || '').toUpperCase().includes('LIMITED'));
    const limited = cards.find(candidate => candidate.group === 'support' && String(candidate.type || '').toUpperCase().includes('LIMITED'));
    const target = card('hSD12-009');
    assert.ok(support && limited && target, 'catalog needs normal and LIMITED Support plus an Advent target');
    let battle = performance(shiori.number);
    battle.players[0].archive = [inst(support.number, 'recoverable-support'), inst(limited.number, 'limited-support')];
    battle.players[1].zones.center = unit(target.number, { damage: Number(target.hp) - 120 });
    fund(battle.players[0].zones.center, shiori.arts[0].cost);

    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(battle.pendingChoice?.effect, 'specialDamage');
    assert.equal(battle.pendingChoice.meta.amount, 10);
    battle = choose(battle, { zone: 'center' });
    assert.equal(battle.pendingChoice?.effect, 'archiveToHand', 'the knockout should trigger Gift after special damage resolves');
    assert.deepEqual(battle.pendingChoice.selectableIds, ['recoverable-support']);
    battle = choose(battle, { cardIds: ['recoverable-support'] });
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'recoverable-support'));
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'limited-support'), 'LIMITED Support remains in Archive');

    let twoCopies = performance(shiori.number);
    twoCopies.players[0].zones.center = unit(shiori.number, { stack: [inst(shiori.number, 'shiori-center')] });
    twoCopies.players[0].zones.collab = unit(shiori.number, { stack: [inst(shiori.number, 'shiori-collab')], returnSlot: 'back1' });
    twoCopies.players[0].archive = [inst(support.number, 'support-a'), inst(support.number, 'support-b')];
    twoCopies.players[1].zones.center = unit('hSD12-010', { damage: 50 });
    twoCopies.players[1].zones.collab = unit('hSD12-009', { damage: 10 });
    fund(twoCopies.players[0].zones.center, shiori.arts[0].cost);
    fund(twoCopies.players[0].zones.collab, shiori.arts[0].cost);
    twoCopies.players[0].zones.collab.cheer.forEach((cheer, index) => { cheer.id = `collab-cheer-${index}`; });

    twoCopies = act(twoCopies, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    twoCopies = choose(twoCopies, { zone: 'center' });
    assert.equal(twoCopies.pendingChoice?.effect, 'archiveToHand');
    twoCopies = choose(twoCopies, { cardIds: ['support-a'] });
    assert.equal(twoCopies.pendingChoice?.type, 'lifeCheerTarget');
    twoCopies = choose(twoCopies, { zone: 'collab' }, 1);
    twoCopies = act(twoCopies, { type: 'attack', sourceZone: 'collab', targetZone: 'collab', artIndex: 0 });
    twoCopies = choose(twoCopies, { zone: 'collab' });
    assert.equal(twoCopies.pendingChoice?.effect, 'archiveToHand', 'a second physical Shiori may resolve her own once-per-turn Gift');
    assert.deepEqual(twoCopies.pendingChoice.selectableIds, ['support-b']);
  });

  test(`${runtime.name}: hSD12-008/009 and hSD12-010 Arts 0 use their printed Colorless cost and damage`, () => {
    for (const number of ['hSD12-008', 'hSD12-009', 'hSD12-010']) {
      const source = card(number);
      let battle = performance(number);
      fund(battle.players[0].zones.center, source.arts[0].cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
      assert.equal(battle.players[1].zones.center.damage, source.arts[0].damage, `${number} base Arts damage`);
    }
  });

  test(`${runtime.name}: hSD12-008 Collab draws one per stage Cheer only for the second player's first turn`, () => {
    const collabFor = (firstPlayer, turnsTaken) => {
      let battle = main('hSD12-003');
      battle.firstPlayer = firstPlayer;
      battle.activePlayer = 1;
      const first = player => {
        player.zones.center.cheer = [inst('hY01-001', `${player.name}-cheer-1`)];
        player.zones.back1 = unit('hSD12-008', { cheer: [inst('hY04-001', `${player.name}-cheer-2`)] });
      };
      first(battle.players[0]);
      first(battle.players[1]);
      battle.players[1].turnsTaken = turnsTaken;
      battle.players[1].mainDeck = Array.from({ length: 10 }, (_, index) => inst(dummy.number, `turn-deck-${index}`));
      battle = act(battle, { type: 'collab', zone: 'back1' }, 1);
      return battle;
    };

    const secondPlayerFirstTurn = collabFor(0, 1);
    assert.equal(secondPlayerFirstTurn.players[1].hand.length, 4);
    assert.equal(secondPlayerFirstTurn.players[1].mainDeck.length, 5, 'collab first moves one card to Holo Power, then draws four');
    assert.equal(secondPlayerFirstTurn.players[1].holoPower.length, 1);

    assert.equal(collabFor(1, 1).players[1].hand.length, 0, 'the first player does not get the first-turn draw');
    assert.equal(collabFor(0, 2).players[1].hand.length, 0, 'the second player gets no repeat trigger on later turns');
  });

  test(`${runtime.name}: hSD12-009 Bloom adds exactly one revealed Advent Holomen and bottoms the rest in chosen order`, () => {
    const bloom = (deck, suffix) => {
      let battle = main('hSD11-003');
      battle.players[0].zones.back1 = unit('hSD12-008', { enteredTurn: 1 });
      battle.players[0].hand = [inst('hSD12-009', `biboo-bloom-${suffix}`)];
      battle.players[0].mainDeck = deck;
      battle = act(battle, { type: 'play', cardId: `biboo-bloom-${suffix}` });
      assert.equal(battle.pendingChoice?.type, 'bloom');
      assert.deepEqual(battle.pendingChoice.options, ['back1']);
      return choose(battle, { zone: 'back1' });
    };
    let battle = bloom([
      inst('hSD12-008', 'advent-debut'),
      inst('hSD12-012', 'advent-nerissa'),
      inst('hSD11-007', 'non-advent'),
    ], 'with-match');
    assert.equal(battle.pendingChoice?.effect, 'topLookToHand');
    assert.deepEqual(battle.pendingChoice.selectableIds, ['advent-debut', 'advent-nerissa']);
    battle = choose(battle, { cardIds: ['advent-nerissa'] });
    assert.equal(battle.pendingChoice?.effect, 'bottomOrder');
    battle = choose(battle, { cardIds: ['non-advent', 'advent-debut'] });
    assert.deepEqual(battle.players[0].hand.map(instance => instance.id), ['advent-nerissa']);
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['non-advent', 'advent-debut']);

    battle = bloom([inst(dummy.number, 'no-match-1'), inst(dummy.number, 'no-match-2'), inst(dummy.number, 'no-match-3')], 'without-match');
    assert.equal(battle.pendingChoice?.effect, 'bottomOrder');
    assert.equal(battle.pendingChoice.min, 3, 'without an Advent Holomen, all revealed cards go to the bottom');
    battle = choose(battle, { cardIds: ['no-match-2', 'no-match-3', 'no-match-1'] });
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['no-match-2', 'no-match-3', 'no-match-1']);
    assert.equal(battle.players[0].hand.length, 0);
  });

  test(`${runtime.name}: hSD12-010 Arts 1 may archive only a non-Purple Cheer, then returns one Archive Holomem`, () => {
    const setup = () => {
      let battle = performance('hSD12-010');
      fund(battle.players[0].zones.center, card('hSD12-010').arts[1].cost);
      battle.players[0].zones.center.cheer.push(inst('hY02-001', 'green-extra'), inst('hY05-001', 'purple-extra'));
      battle.players[0].archive = [inst('hSD12-008', 'archive-holomem')];
      return battle;
    };
    let battle = act(setup(), { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 1 });
    assert.equal(battle.pendingChoice?.effect, 'artArchiveCheerCost');
    assert.equal(battle.pendingChoice.optional, true);
    assert.deepEqual(new Set(battle.pendingChoice.options), new Set(['cheer1', 'green-extra']), 'White and Green Cheer are eligible; Purple Cheer is excluded');
    assert.equal(battle.pendingChoice.options.includes('purple-extra'), false);
    battle = choose(battle, { cheerId: 'green-extra' });
    assert.equal(battle.pendingChoice?.effect, 'archiveToHand');
    assert.deepEqual(battle.pendingChoice.selectableIds, ['archive-holomem']);
    battle = choose(battle, { cardIds: ['archive-holomem'] });
    assert.equal(battle.players[1].zones.center.damage, 50);
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'archive-holomem'));
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'green-extra'));
    assert.ok(battle.players[0].zones.center.cheer.some(instance => instance.id === 'purple-extra'));

    let declined = act(setup(), { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 1 });
    declined = choose(declined, { skip: true });
    assert.equal(declined.pendingChoice, null);
    assert.ok(declined.players[0].zones.center.cheer.some(instance => instance.id === 'green-extra'));
    assert.deepEqual(declined.players[0].archive.map(instance => instance.id), ['archive-holomem']);
    assert.equal(declined.players[1].zones.center.damage, 50);
  });

  test(`${runtime.name}: hSD12-011 Arts reduces Colorless cost by distinct Cheer colors across both Archives`, () => {
    const yellow = cards.find(candidate => candidate.group === 'holomem' && candidate.colors?.includes('黃') && Number(candidate.hp || 0) >= 200);
    assert.ok(yellow, 'catalog needs a durable Yellow Holomen for the printed special target bonus');
    const setup = withGeneric => {
      let battle = performance('hSD12-011');
      battle.players[0].archive = [inst('hY03-001', 'red-a'), inst('hY03-001', 'red-b')];
      battle.players[1].archive = [inst('hY04-001', 'blue-a')];
      battle.players[0].zones.center.cheer = [inst('hY05-001', 'purple-cost')];
      if (withGeneric) battle.players[0].zones.center.cheer.push(inst('hY01-001', 'one-colorless'));
      battle.players[1].zones.center = unit(yellow.number);
      return battle;
    };
    let battle = act(setup(true), { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(battle.players[1].zones.center.damage, 160, 'two distinct Archive Cheer colors reduce the cost by two and Yellow keeps its printed +50');
    assert.throws(() => act(setup(false), { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }), /應援不足/u,
      'three archived Cheer cards with only two distinct colors reduce three Colorless to one, not zero');
  });

  test(`${runtime.name}: hSD12-011 Bloom draws one, then optionally archives stage Cheer and grants +40 Arts`, () => {
    const bloom = () => {
      let battle = main('hSD11-003');
      battle.players[0].zones.center = unit('hSD12-008');
      battle.players[0].zones.back1 = unit('hSD12-010', { cheer: [inst('hY03-001', 'stage-cheer')], enteredTurn: 1 });
      battle.players[0].hand = [inst('hSD12-011', 'biboo-second')];
      battle.players[0].mainDeck = [inst(dummy.number, 'draw-one')];
      battle = act(battle, { type: 'play', cardId: 'biboo-second' });
      assert.equal(battle.pendingChoice?.type, 'bloom');
      return choose(battle, { zone: 'back1' });
    };
    let battle = bloom();
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'draw-one'));
    assert.equal(battle.pendingChoice?.effect, 'hSD12-011-archive');
    assert.equal(battle.pendingChoice.optional, true);
    assert.deepEqual(battle.pendingChoice.options, ['stage-cheer']);
    battle = choose(battle, { cheerId: 'stage-cheer' });
    assert.equal(battle.pendingChoice?.effect, 'addModifier');
    assert.deepEqual(battle.pendingChoice.options, ['center', 'back1']);
    battle = choose(battle, { zone: 'center' });
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'stage-cheer'));
    assert.ok(battle.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 40 && modifier.sourceNumber === 'hSD12-011'));

    let declined = bloom();
    declined = choose(declined, { skip: true });
    assert.ok(declined.players[0].hand.some(instance => instance.id === 'draw-one'));
    assert.ok(declined.players[0].zones.back1.cheer.some(instance => instance.id === 'stage-cheer'));
    assert.equal(declined.pendingChoice, null);
    assert.equal(declined.players[0].zones.center.modifiers.some(modifier => modifier.sourceNumber === 'hSD12-011'), false);
  });

  test(`${runtime.name}: hSD12-012 Arts pays with two Colorless fewer at three Life, but not four`, () => {
    const battleAtLife = life => {
      const battle = performance('hSD12-012');
      battle.players[0].life = Array.from({ length: life }, (_, index) => inst('hY01-001', `life-${life}-${index}`));
      battle.players[0].zones.center.cheer = [inst('hY05-001', 'purple'), inst('hY01-001', 'one-generic')];
      return battle;
    };
    const valid = act(battleAtLife(3), { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(valid.players[1].zones.center.damage, 80);
    assert.throws(() => act(battleAtLife(4), { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }), /應援不足/u,
      'with four Life the printed Purple plus three Colorless cost remains unchanged');
  });
}
