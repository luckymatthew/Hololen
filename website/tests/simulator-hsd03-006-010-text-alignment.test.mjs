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
const performance = source => {
  const battle = state(source, 'AUDIT-DUMMY');
  battle.phase = 'performance';
  return battle;
};
const containsName = (card, name) => [card?.name, card?.jpName, card?.enName].some(value => String(value || '').includes(name));

for (const runtime of runtimes) {
  const { cards, applyAction } = runtime;
  const pool = [...cards, dummy];
  const card = number => cards.find(candidate => candidate.number === number);
  const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);

  test(`${runtime.name}: hSD03-006 Arts values/costs and optional archive of one attached Blue Cheer for Center+Back special damage`, () => {
    const okayu = card('hSD03-006');
    assert.deepEqual(okayu.arts.map(art => [art.damage, art.cost]), [[30, ['藍']], [40, ['藍', '無色']]]);

    let first = performance(okayu.number);
    fund(first.players[0].zones.center, okayu.arts[0].cost);
    first = applyAction(first, 0, { ...attack, artIndex: 0 }, pool, () => 0);
    assert.equal(first.players[1].zones.center.damage, 30);

    let paid = performance(okayu.number);
    paid.players[0].zones.center.cheer = [inst('hY04-001', 'arts-blue'), inst('hY01-001', 'arts-colorless'), inst('hY04-001', 'effect-blue')];
    paid.players[1].zones.back1 = unit('AUDIT-DUMMY');
    paid = applyAction(paid, 0, { ...attack, artIndex: 1 }, pool, () => 0);
    assert.equal(paid.pendingChoice?.effect, 'genericKeywordCheerCost');
    assert.equal(paid.pendingChoice?.optional, true);
    assert.deepEqual(new Set(paid.pendingChoice.cheerOptions.map(option => option.id)), new Set(['arts-blue', 'effect-blue']));
    paid = choose(paid, { cheerId: 'effect-blue' });
    assert.equal(paid.players[0].archive.at(-1)?.id, 'effect-blue');
    assert.equal(paid.players[1].zones.center.damage, 10, 'the 10-point special hit resolves before the base Arts damage');
    assert.equal(paid.pendingChoice?.effect, 'specialDamage');
    assert.deepEqual(paid.pendingChoice.options, ['back1']);
    paid = choose(paid, { zone: 'back1' });
    assert.equal(paid.players[1].zones.back1.damage, 10);
    assert.equal(paid.players[1].zones.center.damage, 50, '40 Arts plus 10 special damage to Center');

    let declined = performance(okayu.number);
    declined.players[0].zones.center.cheer = [inst('hY04-001', 'decline-blue'), inst('hY01-001', 'decline-colorless')];
    declined.players[1].zones.back1 = unit('AUDIT-DUMMY');
    declined = applyAction(declined, 0, { ...attack, artIndex: 1 }, pool, () => 0);
    declined = choose(declined, { skip: true });
    assert.equal(declined.players[1].zones.center.damage, 40);
    assert.equal(declined.players[1].zones.back1.damage, 0, 'declining the optional Cheer archive also declines its special-damage clause');
  });

  test(`${runtime.name}: hSD03-007 Bloom may archive-pick one Cheer and attaches it only to own #ゲーマーズ`, () => {
    const debut = card('hSD03-002');
    const okayu = card('hSD03-007');
    const other = cards.find(candidate => candidate.group === 'holomem' && !candidate.tags.includes('#ゲーマーズ'));
    const cheer = cards.find(candidate => candidate.group === 'cheer');
    assert.ok(other && cheer, 'catalog needs a non-Gamer control and Cheer');

    let battle = main(debut.number);
    battle.players[0].hand = [inst(okayu.number, 'bloom')];
    battle.players[0].archive = [inst(cheer.number, 'archived-cheer')];
    battle.players[0].zones.back1 = unit(other.number);
    battle = applyAction(battle, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.type, 'bloom');
    battle = choose(battle, { zone: 'center' });
    assert.equal(battle.pendingChoice?.effect, 'archiveCheerToStage');
    assert.equal(battle.pendingChoice?.optional, true);
    assert.deepEqual(battle.pendingChoice.meta?.targetRule?.tags, ['#ゲーマーズ']);
    assert.equal(battle.pendingChoice.min, 0);
    assert.equal(battle.pendingChoice.max, 1);
    assert.deepEqual(battle.pendingChoice.selectableIds, ['archived-cheer']);
    battle = choose(battle, { cardIds: ['archived-cheer'] });
    assert.equal(battle.pendingChoice?.effect, 'attachArchiveCheer');
    assert.deepEqual(battle.pendingChoice.options, ['center']);
    battle = choose(battle, { zone: 'center' });
    assert.ok(battle.players[0].zones.center.cheer.some(instance => instance.id === 'archived-cheer'));
    assert.equal(battle.players[0].zones.back1.cheer.length, 0);
    assert.equal(battle.players[0].archive.length, 0);
  });

  test(`${runtime.name}: hSD03-008 Center Gift grants +20 Arts to each of its five named Holomen; off-Center Gift grants none`, () => {
    const gift = card('hSD03-008');
    const names = ['鷹嶺ルイ', '大神ミオ', '白上フブキ', 'ラプラス・ダークネス', '戌神ころね'];
    assert.match(gift.keyword.effect, /僅限中央位置/u);
    for (const name of names) {
      const holomem = cards.find(candidate => candidate.group === 'holomem' && containsName(candidate, name) && candidate.arts?.[0]?.effect === '');
      assert.ok(holomem, `catalog needs a Holomen named ${name}`);
      let battle = performance(gift.number);
      battle.players[0].zones.center = unit(gift.number);
      battle.players[0].zones.collab = unit(holomem.number);
      fund(battle.players[0].zones.collab, holomem.arts[0].cost);
      battle = applyAction(battle, 0, { ...attack, sourceZone: 'collab' }, pool, () => 0);
      assert.equal(battle.players[1].zones.center.damage, holomem.arts[0].damage + 20, `${name} receives the printed +20`);
    }

    const holomem = cards.find(candidate => candidate.group === 'holomem' && containsName(candidate, names[0]));
    let inactive = performance(gift.number);
    inactive.players[0].zones.center = unit('AUDIT-DUMMY');
    inactive.players[0].zones.back2 = unit(gift.number);
    inactive.players[0].zones.collab = unit(holomem.number);
    fund(inactive.players[0].zones.collab, holomem.arts[0].cost);
    inactive = applyAction(inactive, 0, { ...attack, sourceZone: 'collab' }, pool, () => 0);
    assert.equal(inactive.players[1].zones.center.damage, holomem.arts[0].damage, 'the Center-only Gift is inactive while its source is on Back');
  });

  test(`${runtime.name}: hSD03-008 Buzz classification makes its knockout Extra cost its owner exactly 2 Life`, () => {
    const okayu = card('hSD03-008');
    assert.equal(okayu.typeCode, 'buzzCharacter');
    assert.match(okayu.extra, /生命值-2/u);
    let battle = performance('AUDIT-DUMMY');
    battle.players[0].zones.center = unit('AUDIT-DUMMY');
    battle.players[1].zones.center = unit(okayu.number, { damage: Number(okayu.hp) - 10 });
    battle.players[1].zones.back1 = unit('AUDIT-DUMMY');
    const lifeBefore = battle.players[1].life.length;
    battle = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(battle.players[1].zones.center, null);
    assert.equal(battle.players[1].life.length, lifeBefore - 2);
  });

  test(`${runtime.name}: hSD03-008 60-Blue-plus-Colorless Arts resolves as printed`, () => {
    const okayu = card('hSD03-008');
    assert.deepEqual([okayu.arts[0].damage, okayu.arts[0].cost], [60, ['藍', '無色']]);
    let battle = performance(okayu.number);
    fund(battle.players[0].zones.center, okayu.arts[0].cost);
    battle = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 60);
  });

  test(`${runtime.name}: hSD03-009 White-target +50 and required archive of two Blue Cheer for Center+Back damage align`, () => {
    const okayu = card('hSD03-009');
    const white = cards.find(candidate => candidate.group === 'holomem' && candidate.colors.includes('白') && Number(candidate.hp) >= 150);
    assert.ok(white, 'catalog needs a White Holomen');
    assert.deepEqual(okayu.arts.map(art => [art.damage, art.cost]), [[60, ['藍', '無色']], [100, ['藍', '藍', '無色', '無色']]]);

    let normalTarget = performance(okayu.number);
    fund(normalTarget.players[0].zones.center, okayu.arts[0].cost);
    normalTarget = applyAction(normalTarget, 0, { ...attack, artIndex: 0 }, pool, () => 0);
    assert.equal(normalTarget.players[1].zones.center.damage, 60);
    let whiteTarget = performance(okayu.number);
    whiteTarget.players[1].zones.center = unit(white.number);
    fund(whiteTarget.players[0].zones.center, okayu.arts[0].cost);
    whiteTarget = applyAction(whiteTarget, 0, { ...attack, artIndex: 0 }, pool, () => 0);
    assert.equal(whiteTarget.players[1].zones.center.damage, 110);

    let paid = performance(okayu.number);
    paid.players[1].zones.back1 = unit('AUDIT-DUMMY');
    paid.players[0].zones.center.cheer = [
      inst('hY04-001', 'blue-1'), inst('hY04-001', 'blue-2'),
      inst('hY01-001', 'white-1'), inst('hY01-001', 'white-2'),
    ];
    paid = applyAction(paid, 0, { ...attack, artIndex: 1 }, pool, () => 0);
    assert.equal(paid.pendingChoice?.optional, false, 'the two-Blue archive requirement is mandatory');
    assert.deepEqual(new Set(paid.pendingChoice.cheerOptions.map(option => option.id)), new Set(['blue-1', 'blue-2']));
    assert.throws(() => choose(paid, { skip: true }));
    paid = choose(paid, { cheerId: 'blue-1' });
    paid = choose(paid, { cheerId: 'blue-2' });
    assert.equal(paid.players[0].archive.filter(instance => ['blue-1', 'blue-2'].includes(instance.id)).length, 2);
    assert.equal(paid.players[0].zones.center.cheer.length, 2, 'Arts payment and effect archive are separate; only the two Blue effect Cheer move');
    assert.equal(paid.players[1].zones.center.damage, 30, 'the 30-point special hit resolves before the base Arts damage');
    assert.equal(paid.pendingChoice?.effect, 'specialDamage');
    assert.deepEqual(paid.pendingChoice.options, ['back1']);
    paid = choose(paid, { zone: 'back1' });
    assert.equal(paid.players[1].zones.back1.damage, 30);
    assert.equal(paid.players[1].zones.center.damage, 130, '100 Arts plus 30 special damage to Center');
  });

  test(`${runtime.name}: hSD03-010 Spot cannot Bloom; Okayu-Center Collab searches one Mascot/Fan then shuffles`, () => {
    const korone = card('hSD03-010');
    const okayu = card('hSD03-002');
    const mascot = cards.find(candidate => candidate.typeCode === 'supportMascot');
    const fan = cards.find(candidate => candidate.typeCode === 'supportFan');
    assert.ok(mascot && fan, 'catalog needs a Mascot and Fan');
    assert.match(korone.extra, /不能Bloom/u);
    assert.deepEqual([korone.arts[0].damage, korone.arts[0].cost], [30, ['無色']]);

    let illegalBloom = main(okayu.number);
    illegalBloom.players[0].hand = [inst(korone.number, 'korone')];
    illegalBloom = applyAction(illegalBloom, 0, { type: 'play', cardId: 'korone' }, pool, () => 0);
    assert.equal(illegalBloom.pendingChoice?.type, 'playHolomen');
    assert.ok(!illegalBloom.pendingChoice.options.includes('center'), 'Spot can only be deployed to Back, never Bloomed onto Center');
    assert.throws(() => choose(illegalBloom, { zone: 'center' }), /舞台位置|不可/u);

    let battle = main(okayu.number);
    battle.players[0].zones.back1 = unit(korone.number);
    battle.players[0].mainDeck = [inst('AUDIT-DUMMY', 'collab-power'), inst(mascot.number, 'mascot'), inst(fan.number, 'fan'), inst('AUDIT-DUMMY', 'deck-tail')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'deckToHandShuffle');
    assert.deepEqual(new Set(battle.pendingChoice.selectableIds), new Set(['mascot', 'fan']));
    battle = choose(battle, { cardIds: ['mascot'] });
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'mascot'));
    assert.ok(battle.players[0].mainDeck.some(instance => instance.id === 'fan'));
    assert.ok(battle.players[0].mainDeck.some(instance => instance.id === 'deck-tail'));
    assert.equal(battle.players[0].mainDeck.length, 2, 'selected support enters hand and all other cards remain after shuffle');

    let gated = main(card('hBP01-001').number);
    gated.players[0].zones.back1 = unit(korone.number);
    gated.players[0].mainDeck = [inst('AUDIT-DUMMY', 'gated-collab-power'), inst(mascot.number, 'gated-mascot')];
    gated = applyAction(gated, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(gated.pendingChoice, null, 'a Center other than Okayu does not enable the Collab search');
    assert.equal(gated.players[0].hand.length, 0);
  });
}
