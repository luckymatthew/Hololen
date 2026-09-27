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
for (const runtime of runtimes) runtime.pool = [...runtime.cards, dummy];

const choose = (runtime, battle, action, random = () => 0) => runtime.applyAction(battle, 0, { type: 'choose', ...action }, runtime.pool, random);
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

for (const runtime of runtimes) {
  const { cards, pool, applyAction } = runtime;
  const ayameDebut = cards.find(card => card.number === 'hSD02-002');
  const fubukiDebut = cards.find(card => card.group === 'holomem' && card.stage === 'Debut' && cardHasFubuki(card));
  const mascot = cards.find(card => card.group === 'support' && card.typeCode === 'supportMascot');
  const nonMascot = cards.find(card => card.group === 'support' && card.typeCode !== 'supportMascot');
  const yellowHolomem = cards.find(card => card.group === 'holomem' && card.colors.includes('黃') && Number(card.hp) > 130);
  assert.ok(ayameDebut && fubukiDebut && mascot && nonMascot && yellowHolomem, 'catalog needs the printed Bloom, mascot, and Yellow-target fixtures');

  test(`${runtime.name}: hSD02-006 Bloom may archive a hand card then deals 20 special damage to an opposing Center/Collab`, () => {
    const card = cards.find(candidate => candidate.number === 'hSD02-006');
    assert.deepEqual([card.arts[0].damage, card.arts[0].cost], [30, ['紅']]);
    let arts = performance(card.number);
    fund(arts.players[0].zones.center, card.arts[0].cost);
    arts = applyAction(arts, 0, attack, pool, () => 0);
    assert.equal(arts.players[1].zones.center.damage, 30);

    let battle = main(ayameDebut.number);
    battle.players[0].hand = [inst(card.number, 'bloom'), inst('AUDIT-DUMMY', 'cost')];
    battle.players[1].zones.collab = unit('AUDIT-DUMMY');
    battle = applyAction(battle, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
    battle = choose(runtime, battle, { zone: 'center' });
    assert.equal(battle.pendingChoice?.effect, 'genericKeywordHandArchiveCost');
    battle = choose(runtime, battle, { cardIds: ['cost'] });
    assert.equal(battle.pendingChoice?.effect, 'specialDamage');
    assert.deepEqual(battle.pendingChoice.options, ['center', 'collab']);
    battle = choose(runtime, battle, { zone: 'collab' });
    assert.equal(battle.players[1].zones.collab.damage, 20);
    assert.equal(battle.players[1].zones.center.damage, 0);

    let skipped = main(ayameDebut.number);
    skipped.players[0].hand = [inst(card.number, 'skip-bloom'), inst('AUDIT-DUMMY', 'skip-cost')];
    skipped = applyAction(skipped, 0, { type: 'play', cardId: 'skip-bloom' }, pool, () => 0);
    skipped = choose(runtime, skipped, { zone: 'center' });
    skipped = choose(runtime, skipped, { skip: true });
    assert.equal(skipped.players[1].zones.center.damage, 0, 'optional hand cost may be declined');
  });

  test(`${runtime.name}: hSD02-007 Bloom adds one of the top two cards to hand and archives the other`, () => {
    const card = cards.find(candidate => candidate.number === 'hSD02-007');
    assert.deepEqual([card.arts[0].damage, card.arts[0].cost], [30, ['無色']]);
    let arts = performance(card.number);
    fund(arts.players[0].zones.center, card.arts[0].cost);
    arts = applyAction(arts, 0, attack, pool, () => 0);
    assert.equal(arts.players[1].zones.center.damage, 30);

    let battle = main(ayameDebut.number);
    battle.players[0].hand = [inst(card.number, 'bloom')];
    battle.players[0].mainDeck = [inst('hSD02-002', 'top-1'), inst('hSD02-003', 'top-2')];
    battle = applyAction(battle, 0, { type: 'play', cardId: 'bloom' }, pool, () => 0);
    battle = choose(runtime, battle, { zone: 'center' });
    assert.equal(battle.pendingChoice?.effect, 'genericTopLook');
    assert.deepEqual(battle.pendingChoice.selectableIds, ['top-1', 'top-2']);
    battle = choose(runtime, battle, { cardIds: ['top-1'] });
    assert.deepEqual(battle.players[0].hand.map(instance => instance.id), ['top-1']);
    assert.deepEqual(battle.players[0].archive.map(instance => instance.id), ['top-2']);
    assert.equal(battle.players[0].mainDeck.length, 0);
  });

  test(`${runtime.name}: hSD02-008 Buzz Extra matches the established two-Life knockout rule`, () => {
    const card = cards.find(candidate => candidate.number === 'hSD02-008');
    assert.equal(card.typeCode, 'buzzCharacter');
    let battle = state(card.number, 'AUDIT-DUMMY');
    battle.activePlayer = 1;
    battle.phase = 'performance';
    battle.players[0].zones.center.damage = Number(card.hp) - 1;
    battle.players[1].zones.center = unit('AUDIT-DUMMY');
    battle = applyAction(battle, 1, attack, pool, () => 0);
    assert.equal(battle.players[0].zones.center, null);
    assert.equal(battle.players[0].life.length, 3, 'the Buzz knockout rule costs two Life total; the printed Extra does not stack another two');
  });

  test(`${runtime.name}: hSD02-008 Arts costs/damage and optional 50 special damage follow the text`, () => {
    const card = cards.find(candidate => candidate.number === 'hSD02-008');
    assert.deepEqual(card.arts.map(art => [art.damage, art.cost]), [[40, ['紅', '無色']], [50, ['紅', '紅', '無色']]]);
    let battle = performance(card.number);
    fund(battle.players[0].zones.center, card.arts[1].cost);
    battle.players[0].hand = [inst('AUDIT-DUMMY', 'payment')];
    battle.players[1].zones.collab = unit('AUDIT-DUMMY');
    battle = applyAction(battle, 0, { ...attack, artIndex: 1 }, pool, () => 0);
    battle = choose(runtime, battle, { cardIds: ['payment'] });
    assert.equal(battle.pendingChoice?.effect, 'specialDamage');
    assert.deepEqual(battle.pendingChoice.options, ['center', 'collab']);
    battle = choose(runtime, battle, { zone: 'collab' });
    assert.equal(battle.players[1].zones.collab.damage, 50);
  });

  test(`${runtime.name}: hSD02-009 Arts values, Yellow bonus, costs, and per-card Center special damage align`, () => {
    const card = cards.find(candidate => candidate.number === 'hSD02-009');
    assert.deepEqual(card.arts.map(art => [art.damage, art.cost]), [[60, ['紅']], [40, ['紅', '紅', '無色']]]);
    let first = performance(card.number);
    first.players[0].zones.center = unit(card.number);
    fund(first.players[0].zones.center, card.arts[0].cost);
    first.players[1].zones.center = unit(yellowHolomem.number);
    first = applyAction(first, 0, { ...attack, artIndex: 0 }, pool, () => 0);
    assert.equal(first.players[1].zones.center.damage, 110, '60 Arts +50 Yellow-target bonus');

    let second = performance(card.number);
    second.players[0].zones.center = unit(card.number);
    fund(second.players[0].zones.center, card.arts[1].cost);
    second.players[0].hand = [inst('AUDIT-DUMMY', 'archive-cost-1'), inst('AUDIT-DUMMY', 'archive-cost-2')];
    second.players[1].zones.center = unit(yellowHolomem.number);
    second = applyAction(second, 0, { ...attack, artIndex: 1 }, pool, () => 0);
    assert.equal(second.pendingChoice?.effect, 'genericKeywordHandArchiveCost');
    second = choose(runtime, second, { cardIds: ['archive-cost-1', 'archive-cost-2'] });
    assert.equal(second.players[1].zones.center.damage, 170, '40 Arts +50 Yellow-target bonus +2 × 40 special damage for the archived hand cards');
  });

  test(`${runtime.name}: hSD02-010 Spot cannot Bloom, recovers an archived mascot on Collab, and has 20 Colorless Arts`, () => {
    const card = cards.find(candidate => candidate.number === 'hSD02-010');
    let illegalBloom = main(fubukiDebut.number);
    illegalBloom.players[0].hand = [inst(card.number, 'spot')];
    illegalBloom = applyAction(illegalBloom, 0, { type: 'play', cardId: 'spot' }, pool, () => 0);
    assert.throws(() => choose(runtime, illegalBloom, { zone: 'center' }), /合法|Bloom|綻放|不可/u);

    let battle = main(ayameDebut.number);
    battle.players[0].zones.back1 = unit(card.number);
    battle.players[0].mainDeck = [inst('AUDIT-DUMMY', 'collab-cost')];
    battle.players[0].archive = [inst(mascot.number, 'mascot'), inst(nonMascot.number, 'other-support')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'archiveToHand');
    assert.equal(battle.pendingChoice.optional, true);
    assert.deepEqual(battle.pendingChoice.selectableIds, ['mascot']);
    battle = choose(runtime, battle, { cardIds: ['mascot'] });
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'mascot'));
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'other-support'));

    let arts = performance(card.number);
    arts.players[0].zones.collab = unit(card.number);
    fund(arts.players[0].zones.collab, card.arts[0].cost);
    arts = applyAction(arts, 0, { ...attack, sourceZone: 'collab' }, pool, () => 0);
    assert.equal(arts.players[1].zones.center.damage, 20);
    assert.equal(card.arts[0].damage, 20);
    assert.deepEqual(card.arts[0].cost, ['無色']);
  });
}

function cardHasFubuki(card) {
  return /白上フブキ|白上吹雪/u.test(`${card.name} ${card.jpName}`);
}
