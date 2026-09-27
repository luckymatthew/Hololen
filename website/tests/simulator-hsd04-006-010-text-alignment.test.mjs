import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, state, unit, inst, fund, attack } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const cards = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, cards });
}

const main = source => {
  const battle = state(source, 'AUDIT-DUMMY');
  battle.phase = 'main';
  return battle;
};
const performance = (source, target = 'AUDIT-DUMMY') => {
  const battle = state(source, target);
  battle.phase = 'performance';
  return battle;
};

for (const runtime of runtimes) {
  const { cards, applyAction } = runtime;
  const foodEvent = cards.find(candidate => candidate.typeCode === 'supportEvent' && candidate.tags.includes('#食べ物'));
  const supportItem = cards.find(candidate => candidate.typeCode === 'supportItem');
  const foodLimitedEventControl = foodEvent && { ...foodEvent, number: 'AUDIT-FOOD-LIMITED-EVENT', typeCode: 'supportEventLimited' };
  const foodItemControl = supportItem && { ...supportItem, number: 'AUDIT-FOOD-ITEM', tags: [...supportItem.tags, '#食べ物'] };
  const pool = [...cards, dummy, foodLimitedEventControl, foodItemControl].filter(Boolean);
  const card = number => cards.find(candidate => candidate.number === number);
  const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);
  const play = (battle, id) => applyAction(battle, 0, { type: 'play', cardId: id }, pool, () => 0);

  test(`${runtime.name}: hSD04-006 heals its own Holomen by each 10 damage actually dealt, after damage modifiers`, () => {
    const choco = card('hSD04-006');
    assert.deepEqual([choco.arts[0].damage, choco.arts[0].cost], [30, ['紫', '無色']]);

    for (const reduction of [0, 10]) {
      let battle = performance(choco.number);
      battle.players[0].zones.center.damage = 80;
      battle.players[1].zones.center.modifiers = reduction
        ? [{ kind: 'artsDamageReduction', amount: reduction, expiresTurn: battle.turn }]
        : [];
      fund(battle.players[0].zones.center, choco.arts[0].cost);
      battle = applyAction(battle, 0, attack, pool, () => 0);
      const actualDamage = 30 - reduction;
      assert.equal(battle.players[1].zones.center.damage, actualDamage);
      assert.equal(battle.players[0].zones.center.damage, 80 - actualDamage,
        'healing follows final damage, rather than the printed 30 Arts value');
    }
  });

  test(`${runtime.name}: hSD04-007 Bloom optionally returns only a non-LIMITED Event; Arts requires a Back heal`, () => {
    const prior = cards.find(candidate => candidate.jpName === '癒月ちょこ' && candidate.stage === 'Debut');
    const choco = card('hSD04-007');
    const event = cards.find(candidate => candidate.typeCode === 'supportEvent');
    const limited = cards.find(candidate => candidate.typeCode === 'supportEventLimited');
    const item = cards.find(candidate => candidate.typeCode === 'supportItem');
    assert.ok(prior && event && limited && item);
    assert.deepEqual([choco.arts[0].damage, choco.arts[0].cost], [30, ['無色', '無色']]);

    let battle = main(prior.number);
    battle.players[0].hand = [inst(choco.number, 'bloom')];
    battle.players[0].archive = [inst(event.number, 'event'), inst(limited.number, 'limited'), inst(item.number, 'item')];
    battle = play(battle, 'bloom');
    battle = choose(battle, { zone: 'center' });
    assert.equal(battle.pendingChoice?.optional, true);
    assert.deepEqual(battle.pendingChoice.cards.map(instance => instance.id), ['event']);
    let skipped = main(prior.number);
    skipped.players[0].hand = [inst(choco.number, 'skip-bloom')];
    skipped.players[0].archive = [inst(event.number, 'skip-event'), inst(limited.number, 'skip-limited')];
    skipped = play(skipped, 'skip-bloom');
    skipped = choose(skipped, { zone: 'center' });
    skipped = choose(skipped, { skip: true });
    assert.equal(skipped.pendingChoice, null, 'returning the Event is optional');
    assert.ok(skipped.players[0].archive.some(instance => instance.id === 'skip-event'));
    battle = choose(battle, { cardIds: ['event'] });
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'event'));
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'limited'));

    let heal = performance(choco.number);
    fund(heal.players[0].zones.center, choco.arts[0].cost);
    heal.players[0].zones.center.damage = 30;
    heal.players[0].zones.back1 = unit('AUDIT-DUMMY', { damage: 30 });
    heal.players[0].zones.collab = unit('AUDIT-DUMMY', { damage: 20 });
    heal = applyAction(heal, 0, attack, pool, () => 0);
    assert.equal(heal.pendingChoice?.optional, false);
    assert.deepEqual(heal.pendingChoice?.options, ['back1', 'back2', 'back3', 'back4', 'back5'].filter(zone => Boolean(heal.players[0].zones[zone])));
    assert.ok(!heal.pendingChoice.options.includes('collab'), 'Arts heals only the Back row');
    heal = choose(heal, { zone: 'back1' });
    assert.equal(heal.players[0].zones.back1.damage, 10);
    assert.equal(heal.players[0].zones.collab.damage, 20);
  });

  test(`${runtime.name}: hSD04-008 Arts values, optional #食べ物 Event payment, and Buzz two-Life knockout rule align`, () => {
    const choco = card('hSD04-008');
    const foodEvents = pool.filter(candidate => ['supportEvent', 'supportEventLimited'].includes(candidate.typeCode) && candidate.tags.includes('#食べ物'));
    const ordinaryEvent = cards.find(candidate => candidate.typeCode === 'supportEvent' && !candidate.tags.includes('#食べ物'));
    const foodItem = foodItemControl;
    assert.ok(foodEvents.length && ordinaryEvent && foodItem, 'catalog needs eligible and ineligible Food/Event controls');
    assert.equal(choco.typeCode, 'buzzCharacter');
    assert.match(choco.extra, /生命.*-2/u);
    assert.deepEqual(choco.arts.map(art => [art.damage, art.cost]), [[40, ['紫', '無色']], [60, ['紫', '紫', '無色']]]);

    let first = performance(choco.number);
    fund(first.players[0].zones.center, choco.arts[0].cost);
    first = applyAction(first, 0, { ...attack, artIndex: 0 }, pool, () => 0);
    assert.equal(first.players[1].zones.center.damage, 40);

    const food = foodEvents[0];
    let paid = performance(choco.number);
    const foodLimited = foodEvents.find(candidate => candidate.typeCode === 'supportEventLimited');
    assert.ok(foodLimited);
    paid.players[0].archive = [inst(ordinaryEvent.number, 'ordinary-event'), inst(foodItem.number, 'food-item'), inst(food.number, 'food-event'), inst(foodLimited.number, 'food-limited-event')];
    fund(paid.players[0].zones.center, choco.arts[1].cost);
    paid = applyAction(paid, 0, { ...attack, artIndex: 1 }, pool, () => 0);
    assert.equal(paid.pendingChoice?.effect, 'artArchiveToHandCost');
    assert.equal(paid.pendingChoice?.optional, true);
    assert.deepEqual(new Set(paid.pendingChoice.selectableIds), new Set(['food-event', 'food-limited-event']));
    paid = choose(paid, { cardIds: ['food-limited-event'] });
    assert.ok(paid.players[0].hand.some(instance => instance.id === 'food-limited-event'));
    assert.equal(paid.players[1].zones.center.damage, 80, 'the optional Food Event adds 20 to the printed 60');

    let declined = performance(choco.number);
    declined.players[0].archive = [inst(food.number, 'declined-food-event')];
    fund(declined.players[0].zones.center, choco.arts[1].cost);
    declined = applyAction(declined, 0, { ...attack, artIndex: 1 }, pool, () => 0);
    declined = choose(declined, { skip: true });
    assert.equal(declined.players[1].zones.center.damage, 60);
    assert.equal(declined.players[0].archive[0].id, 'declined-food-event');

    let knockout = performance('AUDIT-DUMMY', choco.number);
    knockout.players[1].zones.center = unit(choco.number, { damage: Number(choco.hp) - 100 });
    const lifeBefore = knockout.players[1].life.length;
    knockout = applyAction(knockout, 0, attack, pool, () => 0);
    assert.equal(knockout.players[1].zones.center, null);
    assert.equal(knockout.players[1].life.length, lifeBefore - 2);
  });

  test(`${runtime.name}: hSD04-009 Arts grant the printed Green bonus and +40 for each Event used this turn`, () => {
    const choco = card('hSD04-009');
    const green = cards.find(candidate => candidate.group === 'holomem' && candidate.colors.includes('綠') && Number(candidate.hp) >= 250);
    const event = cards.find(candidate => candidate.typeCode === 'supportEvent');
    const limited = cards.find(candidate => candidate.typeCode === 'supportEventLimited');
    const item = cards.find(candidate => candidate.typeCode === 'supportItem');
    assert.ok(green && event && limited && item);
    assert.deepEqual(choco.arts.map(art => [art.damage, art.cost, art.specialTargets, art.specialValues]), [
      [50, ['紫', '無色'], ['綠'], [50]],
      [60, ['紫', '紫', '無色'], ['綠'], [50]],
    ]);

    let basic = performance(choco.number);
    basic.players[1].zones.center = unit(green.number);
    fund(basic.players[0].zones.center, choco.arts[0].cost);
    basic = applyAction(basic, 0, attack, pool, () => 0);
    assert.equal(basic.players[1].zones.center.damage, 100, '50 printed Arts plus 50 against Green');

    let boosted = performance(choco.number);
    boosted.players[1].zones.center = unit(green.number);
    boosted.players[0].turnEvents = { turn: boosted.turn, arts: [], supports: [event.number, limited.number, item.number] };
    fund(boosted.players[0].zones.center, choco.arts[1].cost);
    boosted = applyAction(boosted, 0, { ...attack, artIndex: 1 }, pool, () => 0);
    assert.equal(boosted.players[1].zones.center.damage, 190, '60 printed, +80 for two Event cards, and +50 against Green; Support Item is not an Event');

    let nonGreen = performance(choco.number);
    fund(nonGreen.players[0].zones.center, choco.arts[0].cost);
    nonGreen = applyAction(nonGreen, 0, attack, pool, () => 0);
    assert.equal(nonGreen.players[1].zones.center.damage, 50);
  });

  test(`${runtime.name}: hSD04-010 Spot cannot Bloom; Choco-Center Collab optionally attaches one archived Cheer to own stage`, () => {
    const subaru = card('hSD04-010');
    const debutChoco = cards.find(candidate => candidate.group === 'holomem' && candidate.jpName === '癒月ちょこ' && candidate.stage === 'Debut');
    const firstChoco = card('hSD04-005');
    const otherCenter = card('hSD03-002');
    const cheer = cards.find(candidate => candidate.group === 'cheer');
    const event = cards.find(candidate => candidate.typeCode === 'supportEvent');
    assert.ok(debutChoco && firstChoco && otherCenter && cheer && event);
    assert.equal(subaru.stage, 'Spot');
    assert.match(subaru.extra, /不能進行Bloom/u);
    assert.deepEqual([subaru.arts[0].damage, subaru.arts[0].cost], [20, ['無色', '無色']]);

    let illegalBloom = main(debutChoco.number);
    illegalBloom.players[0].hand = [inst(subaru.number, 'subaru-spot')];
    illegalBloom = play(illegalBloom, 'subaru-spot');
    assert.ok(illegalBloom.pendingChoice?.options.includes('back1'));
    assert.ok(!illegalBloom.pendingChoice?.options.includes('center'));

    let battle = main(firstChoco.number);
    battle.players[0].zones.back1 = unit(subaru.number);
    battle.players[0].zones.back2 = unit('AUDIT-DUMMY');
    battle.players[0].archive = [inst(event.number, 'not-cheer'), inst(cheer.number, 'archive-cheer')];
    battle.players[0].mainDeck = [inst('AUDIT-DUMMY', 'collab-power')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'archiveCheerToStage');
    assert.equal(battle.pendingChoice?.optional, true);
    assert.deepEqual(battle.pendingChoice.selectableIds, ['archive-cheer']);
    battle = choose(battle, { cardIds: ['archive-cheer'] });
    assert.equal(battle.pendingChoice?.effect, 'attachArchiveCheer');
    assert.ok(battle.pendingChoice.options.includes('back2'), 'the text allows attachment to any own Holomen');
    battle = choose(battle, { zone: 'back2' });
    assert.equal(battle.players[0].zones.back2.cheer[0]?.id, 'archive-cheer');
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'not-cheer'));

    let gated = main(otherCenter.number);
    gated.players[0].zones.back1 = unit(subaru.number);
    gated.players[0].archive = [inst(cheer.number, 'gated-cheer')];
    gated.players[0].mainDeck = [inst('AUDIT-DUMMY', 'gated-collab-power')];
    gated = applyAction(gated, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(gated.pendingChoice, null, 'without Choco at Center, no Cheer may be selected');
    assert.equal(gated.players[0].archive[0].id, 'gated-cheer');

    let declined = main(firstChoco.number);
    declined.players[0].zones.back1 = unit(subaru.number);
    declined.players[0].archive = [inst(cheer.number, 'decline-cheer')];
    declined.players[0].mainDeck = [inst('AUDIT-DUMMY', 'decline-collab-power')];
    declined = applyAction(declined, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    declined = choose(declined, { skip: true });
    assert.equal(declined.pendingChoice, null);
    assert.equal(declined.players[0].archive[0].id, 'decline-cheer');

    let arts = performance(subaru.number);
    fund(arts.players[0].zones.center, subaru.arts[0].cost);
    arts = applyAction(arts, 0, attack, pool, () => 0);
    assert.equal(arts.players[1].zones.center.damage, 20);
  });
}
