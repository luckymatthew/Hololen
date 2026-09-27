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
  const main = source => { const battle = state(source); battle.phase = 'main'; return battle; };
  const performance = source => { const battle = state(source); battle.phase = 'performance'; return battle; };

  test(`${runtime.name}: hSD12-013/014 printed Colorless Arts each deal 30`, () => {
    for (const number of ['hSD12-013', 'hSD12-014']) {
      const source = card(number);
      let battle = performance(number);
      fund(battle.players[0].zones.center, source.arts[0].cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
      assert.equal(battle.players[1].zones.center.damage, 30, `${number} printed base Arts`);
    }
  });

  test(`${runtime.name}: hSD12-013 Collab may return a Back Debut, bottoms it and draws two only on Advent board`, () => {
    const setup = adventBoard => {
      let battle = main('hSD11-003');
      battle.players[0].zones.center = unit('hSD12-007');
      battle.players[0].zones.back1 = unit('hSD12-013', { stack: [inst('hSD12-013', 'mococo-collab')] });
      battle.players[0].zones.back2 = unit(adventBoard ? 'hSD12-008' : 'hSD11-007', { stack: [inst(adventBoard ? 'hSD12-008' : 'hSD11-007', 'debut-back')] });
      battle.players[0].mainDeck = [inst(dummy.number, 'collab-power'), inst(dummy.number, 'draw-one'), inst(dummy.number, 'draw-two'), inst(dummy.number, 'deck-left')];
      return battle;
    };
    let battle = act(setup(true), { type: 'collab', zone: 'back1' });
    assert.equal(battle.pendingChoice?.effect, 'returnBackDebutDraw');
    assert.equal(battle.pendingChoice.optional, true);
    assert.deepEqual(battle.pendingChoice.options, ['back2']);
    battle = choose(battle, { zone: 'back2' });
    assert.equal(battle.players[0].zones.back2, null);
    assert.deepEqual(battle.players[0].hand.map(instance => instance.id), ['draw-one', 'draw-two']);
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['deck-left', 'debut-back']);

    let declined = act(setup(true), { type: 'collab', zone: 'back1' });
    declined = choose(declined, { skip: true });
    assert.ok(declined.players[0].zones.back2, 'declining leaves the Debut in the Back');
    assert.equal(declined.players[0].hand.length, 0);

    for (const number of ['hSD12-013', 'hSD12-014']) {
      let blocked = setup(false);
      blocked.players[0].zones.back1 = unit(number);
      blocked = act(blocked, { type: 'collab', zone: 'back1' });
      assert.equal(blocked.pendingChoice, null, `${number} does not offer the effect when any own Holomen lacks #Advent`);
    }
  });

  test(`${runtime.name}: hSD12-014 Collab returns a Back Debut, then attaches only the Cheer Deck top`, () => {
    let battle = main('hSD11-003');
    battle.players[0].zones.center = unit('hSD12-007');
    battle.players[0].zones.back1 = unit('hSD12-014', { stack: [inst('hSD12-014', 'fuwawa-collab')] });
    battle.players[0].zones.back2 = unit('hSD12-008', { stack: [inst('hSD12-008', 'fuwawa-debut-cost')] });
    battle.players[0].cheerDeck = [inst('hY03-001', 'cheer-top'), inst('hY04-001', 'cheer-next')];
    battle = act(battle, { type: 'collab', zone: 'back1' });
    assert.equal(battle.pendingChoice?.effect, 'returnBackDebutForCheer');
    assert.deepEqual(battle.pendingChoice.options, ['back2']);
    battle = choose(battle, { zone: 'back2' });
    assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
    assert.equal(battle.pendingChoice.cardNumber, 'hY03-001');
    assert.deepEqual(battle.pendingChoice.options, ['center', 'collab']);
    battle = choose(battle, { zone: 'collab' });
    assert.ok(battle.players[0].zones.collab.cheer.some(instance => instance.id === 'cheer-top'));
    assert.deepEqual(battle.players[0].cheerDeck.map(instance => instance.id), ['cheer-next']);
    assert.equal(battle.players[0].mainDeck.at(-1).id, 'fuwawa-debut-cost');
  });

  test(`${runtime.name}: hSD12-015 requires an all-Advent stage, deals 20 special damage and attaches one Archive Cheer`, () => {
    const escape = card('hSD12-015');
    const setup = allAdvent => {
      let battle = main('hSD11-003');
      battle.players[0].zones.center = unit('hSD12-007');
      battle.players[0].zones.back1 = unit(allAdvent ? 'hSD12-008' : 'hSD11-007');
      battle.players[0].archive = [inst('hY06-001', 'archive-cheer')];
      battle.players[0].hand = [inst(escape.number, 'successful-escape')];
      battle.players[1].zones.center = unit(dummy.number, { stack: [inst(dummy.number, 'opponent-center')] });
      return battle;
    };
    assert.throws(() => act(setup(false), { type: 'play', cardId: 'successful-escape' }), /所有 Holomen 都必須持有 #Advent/u);
    let battle = act(setup(true), { type: 'play', cardId: 'successful-escape' });
    assert.equal(battle.players[1].zones.center.damage, 20);
    assert.equal(battle.pendingChoice?.effect, 'archiveCheerToStage');
    assert.deepEqual(battle.pendingChoice.selectableIds, ['archive-cheer']);
    battle = choose(battle, { cardIds: ['archive-cheer'] });
    assert.equal(battle.pendingChoice?.effect, 'attachArchiveCheer');
    assert.equal(battle.pendingChoice?.type, 'stageTarget');
    assert.deepEqual(battle.pendingChoice.options, ['center', 'back1']);
    battle = choose(battle, { zone: 'back1' });
    assert.ok(battle.players[0].zones.back1.cheer.some(instance => instance.id === 'archive-cheer'));
    assert.equal(battle.players[0].archive.some(instance => instance.id === 'archive-cheer'), false);
  });

  test(`${runtime.name}: hSD12-016 mascot gives +20 HP to any Holomen, not just the Biboo attachment-trigger target`, () => {
    let battle = main('hSD12-007');
    battle.players[0].zones.center = unit('hSD12-007', { damage: 200 });
    battle.players[0].hand = [inst('hSD12-016', 'geow-on-shiori')];
    battle = act(battle, { type: 'play', cardId: 'geow-on-shiori' });
    assert.deepEqual(battle.pendingChoice?.options, ['center']);
    battle = choose(battle, { zone: 'center' });
    assert.ok(battle.players[0].zones.center.attachments.some(instance => instance.id === 'geow-on-shiori'));
    assert.equal(battle.pendingChoice, null, 'the optional Cheer cost trigger is Biboo-only');

    battle.phase = 'performance';
    battle.activePlayer = 1;
    battle.players[1].zones.center = unit('hBP01-016');
    fund(battle.players[1].zones.center, card('hBP01-016').arts[0].cost);
    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, 1);
    assert.ok(battle.players[0].zones.center, '200 base HP plus 20 mascot HP leaves the Holomen alive at 210 damage');
    assert.equal(battle.players[0].zones.center.damage, 210);
  });

  test(`${runtime.name}: hSD12-016 hand attachment to 1st+ Biboo may archive one Cheer and gives a deck Cheer to own stage`, () => {
    let battle = main('hSD12-010');
    battle.players[0].zones.center = unit('hSD12-010', { cheer: [inst('hY01-001', 'stage-cost')] });
    battle.players[0].zones.back1 = unit('hSD12-007');
    battle.players[0].hand = [inst('hSD12-016', 'geow-biboo'), inst('hSD12-016', 'geow-other')];
    battle.players[0].cheerDeck = [inst('hY03-001', 'cheer-top'), inst('hY04-001', 'cheer-choice'), inst('hY02-001', 'cheer-last')];
    battle = act(battle, { type: 'play', cardId: 'geow-biboo' });
    battle = choose(battle, { zone: 'center' });
    assert.equal(battle.pendingChoice?.effect, 'geowCost');
    assert.equal(battle.pendingChoice.optional, true);
    assert.deepEqual(battle.pendingChoice.options, ['stage-cost']);
    battle = choose(battle, { cheerId: 'stage-cost' });
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'stage-cost'));
    assert.equal(battle.pendingChoice?.effect, 'geowCheer');
    assert.deepEqual(new Set(battle.pendingChoice.selectableIds), new Set(['cheer-top', 'cheer-choice', 'cheer-last']));
    battle = choose(battle, { cardIds: ['cheer-choice'] });
    assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
    assert.equal(battle.pendingChoice.cheerCard.id, 'cheer-choice');
    battle = choose(battle, { zone: 'back1' });
    assert.ok(battle.players[0].zones.back1.cheer.some(instance => instance.id === 'cheer-choice'));
    assert.equal(battle.players[0].cheerDeck.some(instance => instance.id === 'cheer-choice'), false);
    assert.equal(battle.players[0].cheerDeck.length, 2);

    battle.players[0].zones.back1 = unit('hSD12-007');
    battle = act(battle, { type: 'play', cardId: 'geow-other' });
    assert.deepEqual(battle.pendingChoice?.options, ['back1'], 'a second mascot cannot be attached to the already-equipped Biboo');
    battle = choose(battle, { zone: 'back1' });
    assert.ok(battle.players[0].zones.back1.attachments.some(instance => instance.id === 'geow-other'));
    assert.equal(battle.pendingChoice, null, 'the hand-entry ability does not fire on non-Biboo');
  });
}
