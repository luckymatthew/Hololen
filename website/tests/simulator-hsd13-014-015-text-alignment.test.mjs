import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, fund, attack } from './fixtures/simulator-audit.mjs';

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
  const act = (battle, action) => applyAction(battle, 0, action, pool, () => 0);
  const choose = (battle, action) => act(battle, { type: 'choose', ...action });
  const main = source => { const battle = state(source); battle.phase = 'main'; return battle; };
  const performance = source => { const battle = state(source); battle.phase = 'performance'; return battle; };

  test(`${runtime.name}: hSD13-014 Arts deals 40 and attaches only to a Justice Holomen`, () => {
    assert.deepEqual([card('hSD13-014').arts[0].damage, card('hSD13-014').arts[0].cost], [40, ['無色', '無色']]);
    let battle = performance('hSD13-014');
    battle.players[0].zones.back1 = unit('hBP04-016');
    battle.players[0].zones.back2 = unit('AUDIT-DUMMY');
    battle.players[0].cheerDeck = [inst('hY01-001', 'top-cheer'), inst('hY02-001', 'next-cheer')];
    fund(battle.players[0].zones.center, card('hSD13-014').arts[0].cost);
    battle = act(battle, attack);
    assert.equal(battle.players[1].zones.center.damage, 0, 'Arts damage remains queued until its Cheer target resolves');
    assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
    assert.deepEqual(battle.pendingChoice.options, ['center', 'back1'], 'only Justice units may receive the top Cheer');
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.players[1].zones.center.damage, 40);
    assert.deepEqual(battle.players[0].zones.back1.cheer.map(instance => instance.id), ['top-cheer']);
    assert.deepEqual(battle.players[0].cheerDeck.map(instance => instance.id), ['next-cheer']);

    battle = performance('hSD13-014');
    fund(battle.players[0].zones.center, card('hSD13-014').arts[0].cost);
    battle = act(battle, attack);
    assert.equal(battle.players[1].zones.center.damage, 40);
    assert.equal(battle.pendingChoice, null, 'an empty Cheer Deck does not create a nonexistent Cheer attachment');
  });

  test(`${runtime.name}: hSD13-014 Gift draws on Justice Debut/Spot entry only from Center or Collab, once per turn`, () => {
    const enter = (battle, number, id, zone) => {
      battle.players[0].hand.push(inst(number, id));
      battle = act(battle, { type: 'play', cardId: id });
      assert.equal(battle.pendingChoice?.type, 'playHolomen');
      return choose(battle, { zone });
    };

    for (const [number, id] of [['hSD13-003', 'justice-debut'], ['hBP04-087', 'justice-spot']]) {
      let battle = main('hSD13-014');
      battle.players[0].mainDeck = [inst('AUDIT-DUMMY', `draw-${id}`), inst('AUDIT-DUMMY', `tail-${id}`)];
      battle = enter(battle, number, id, 'back1');
      assert.deepEqual(battle.players[0].hand.map(instance => instance.id), [`draw-${id}`]);
      assert.equal(battle.players[0].mainDeck.length, 1);
    }

    let collabGift = main('hBP04-028');
    collabGift.players[0].zones.collab = unit('hSD13-014');
    collabGift.players[0].mainDeck = [inst('AUDIT-DUMMY', 'collab-draw')];
    collabGift = enter(collabGift, 'hSD13-003', 'collab-entry', 'back1');
    assert.deepEqual(collabGift.players[0].hand.map(instance => instance.id), ['collab-draw']);

    let backGift = main('hBP04-028');
    backGift.players[0].zones.back2 = unit('hSD13-014');
    backGift.players[0].mainDeck = [inst('AUDIT-DUMMY', 'no-draw')];
    backGift = enter(backGift, 'hSD13-003', 'back-entry', 'back1');
    assert.deepEqual(backGift.players[0].hand, [], 'a Back-position Gift does not trigger');
    assert.deepEqual(backGift.players[0].mainDeck.map(instance => instance.id), ['no-draw']);

    let once = main('hSD13-014');
    once.players[0].mainDeck = [inst('AUDIT-DUMMY', 'draw-once'), inst('AUDIT-DUMMY', 'draw-must-remain')];
    once = enter(once, 'hSD13-003', 'first-entry', 'back1');
    once = enter(once, 'hBP04-087', 'second-entry', 'back2');
    assert.deepEqual(once.players[0].hand.map(instance => instance.id), ['draw-once'], 'the same Gift source triggers at most once in the turn');
    assert.deepEqual(once.players[0].mainDeck.map(instance => instance.id), ['draw-must-remain']);
  });

  test(`${runtime.name}: hSD13-014 and hSD13-015 Spots cannot be Bloom bases`, () => {
    for (const number of ['hSD13-014', 'hSD13-015']) {
      const spot = card(number);
      assert.equal(spot.stage, 'Spot');
      assert.match(spot.extra, /(?:不能|無法)進行Bloom/u);
      const first = cards.find(candidate => candidate.group === 'holomem' && candidate.jpName === spot.jpName && candidate.stage === '1st');
      assert.ok(first, `${number} requires a same-character 1st for the negative Bloom test`);
      let battle = main(number);
      battle.players[0].hand = [inst(first.number, 'illegal-bloom')];
      battle.players[0].turnsTaken = 2;
      assert.throws(() => act(battle, { type: 'play', cardId: 'illegal-bloom' }), /沒有合法 Bloom 對象/u);
      assert.equal(battle.players[0].zones.center.stack.at(-1).number, number);
    }
  });

  test(`${runtime.name}: hSD13-015 Arts gains 20 only when both Justice Center and Collab have differently colored Cheer`, () => {
    assert.deepEqual([card('hSD13-015').arts[0].damage, card('hSD13-015').arts[0].cost], [30, ['無色']]);
    const damage = ({ centerNumber = 'hSD13-015', centerCheer = 'hY01-001', collabNumber = 'hBP04-016', collabCheer = 'hY02-001', sourceZone = 'center' } = {}) => {
      let battle = performance(centerNumber);
      battle.players[0].zones.center = unit(centerNumber, { cheer: centerCheer ? [inst(centerCheer, 'center-cheer')] : [] });
      battle.players[0].zones.collab = unit(collabNumber, { cheer: collabCheer ? [inst(collabCheer, 'collab-cheer')] : [] });
      if (!battle.players[0].zones[sourceZone].cheer.length) fund(battle.players[0].zones[sourceZone], card('hSD13-015').arts[0].cost);
      battle = act(battle, { type: 'attack', sourceZone, targetZone: 'center', artIndex: 0 });
      return battle.players[1].zones.center.damage;
    };
    assert.equal(damage(), 50, 'White Center Cheer and Green Collab Cheer are different colors');
    assert.equal(damage({ centerCheer: 'hY01-001', collabCheer: 'hY01-001' }), 30, 'matching colors do not grant the bonus');
    assert.equal(damage({ collabCheer: null }), 30, 'both positions must have Cheer');
    assert.equal(damage({ centerNumber: 'AUDIT-DUMMY', collabNumber: 'hSD13-015', sourceZone: 'collab' }), 30, 'Center must be #Justice');
    assert.equal(damage({ centerNumber: 'hSD13-015', collabNumber: 'AUDIT-DUMMY', sourceZone: 'center' }), 30, 'Collab must also be #Justice');
  });

  test(`${runtime.name}: hSD13-015 Collab Gift reveals the Cheer Deck top after bottoming its optional stage Cheer cost`, () => {
    const setup = () => {
      let battle = main('hBP04-016');
      battle.players[0].zones.center.cheer = [inst('hY01-001', 'cost-cheer')];
      battle.players[0].zones.back1 = unit('hSD13-015');
      battle.players[0].cheerDeck = [inst('hY02-001', 'top-reveal'), inst('hY03-001', 'next-reveal')];
      return act(battle, { type: 'collab', zone: 'back1' });
    };

    let battle = setup();
    assert.equal(battle.pendingChoice?.type, 'stageCheerSelection');
    assert.equal(battle.pendingChoice?.effect, 'cheerBottomThenSearch');
    battle = choose(battle, { cheerId: 'cost-cheer' });
    assert.equal(battle.pendingChoice?.type, 'eventCheerTarget', 'the top card is revealed and target selection follows');
    assert.equal(battle.pendingChoice?.cheerCard?.id, 'top-reveal', 'the effect must reveal the Cheer Deck top, not let the user choose any Cheer');
    assert.deepEqual(battle.players[0].cheerDeck.map(instance => instance.id), ['next-reveal', 'cost-cheer']);
    assert.equal(battle.pendingChoice.shuffleAfter, true);
    battle = choose(battle, { zone: 'center' });
    assert.deepEqual(battle.players[0].zones.center.cheer.map(instance => instance.id), ['top-reveal']);
    assert.deepEqual(battle.players[0].cheerDeck.map(instance => instance.id).sort(), ['cost-cheer', 'next-reveal']);

    battle = setup();
    battle = choose(battle, { skip: true });
    assert.equal(battle.pendingChoice, null, 'declining the optional cost skips the reveal');
    assert.deepEqual(battle.players[0].cheerDeck.map(instance => instance.id), ['top-reveal', 'next-reveal']);
    assert.deepEqual(battle.players[0].zones.center.cheer.map(instance => instance.id), ['cost-cheer']);

    battle = main('hBP04-016');
    battle.players[0].zones.back1 = unit('hSD13-015');
    battle.players[0].cheerDeck = [inst('hY02-001', 'unused-top')];
    battle = act(battle, { type: 'collab', zone: 'back1' });
    assert.equal(battle.pendingChoice, null, 'without a stage Cheer cost, the optional Gift is not offered');
    assert.deepEqual(battle.players[0].cheerDeck.map(instance => instance.id), ['unused-top']);
  });
}
