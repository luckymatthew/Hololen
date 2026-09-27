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

for (const runtime of runtimes) {
  const { cards, applyAction } = runtime;
  const pool = [...cards, dummy];
  const map = new Map(pool.map(candidate => [candidate.number, candidate]));
  const card = number => cards.find(candidate => candidate.number === number);
  const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);
  const fubukiDebut = cards.find(candidate => candidate.group === 'holomem' && candidate.stage === 'Debut' && /白上フブキ|白上吹雪/u.test(`${candidate.name} ${candidate.jpName}`));
  const mioDebut = cards.find(candidate => candidate.group === 'holomem' && candidate.stage === 'Debut' && /大神ミオ/u.test(`${candidate.name} ${candidate.jpName}`));
  const ayameDebut = card('hSD02-002');
  const paymentHolomem = cards.find(candidate => candidate.group === 'holomem' && candidate.stage);
  const nonMatchHolomem = cards.find(candidate => candidate.group === 'holomem' && candidate.number !== fubukiDebut?.number && candidate.number !== mioDebut?.number && candidate.number !== ayameDebut?.number);
  const mascot = card('hSD02-014');
  const tool = card('hSD02-013');
  const cheer = cards.find(candidate => candidate.group === 'cheer' && candidate.colors.includes('紅'));
  assert.ok(fubukiDebut && mioDebut && ayameDebut && paymentHolomem && nonMatchHolomem && mascot && tool && cheer, 'catalog needs the hSD02 named Holomen and attachments');

  test(`${runtime.name}: hSD02-011 Spot restriction, optional archive cost, Debut Cheer target and 10-Colorless Arts`, () => {
    const spot = card('hSD02-011');
    let forbidden = main(mioDebut.number);
    forbidden.players[0].hand = [inst(spot.number, 'spot')];
    forbidden = applyAction(forbidden, 0, { type: 'play', cardId: 'spot' }, pool, () => 0);
    assert.throws(() => choose(forbidden, { zone: 'center' }), /不可/u);

    let battle = main(ayameDebut.number);
    battle.players[0].zones.back1 = unit(spot.number);
    battle.players[0].hand = [inst(paymentHolomem.number, 'payment')];
    battle.players[0].cheerDeck = [inst(cheer.number, 'top-cheer')];
    battle.players[0].mainDeck = [inst('AUDIT-DUMMY', 'collab-power')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'genericKeywordHandArchiveCost');
    battle = choose(battle, { cardIds: ['payment'] });
    assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
    assert.deepEqual(battle.pendingChoice.options, ['center']);
    battle = choose(battle, { zone: 'center' });
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'payment'));
    assert.ok(battle.players[0].zones.center.cheer.some(instance => instance.id === 'top-cheer'));

    assert.deepEqual([spot.arts[0].damage, spot.arts[0].cost], [10, ['無色']]);
    let arts = performance(spot.number);
    arts.players[0].zones.collab = unit(spot.number);
    fund(arts.players[0].zones.collab, spot.arts[0].cost);
    arts = applyAction(arts, 0, { ...attack, sourceZone: 'collab' }, pool, () => 0);
    assert.equal(arts.players[1].zones.center.damage, 10);
  });

  test(`${runtime.name}: hSD02-012 LIMITED top-look enforces hand limit, named filters, arbitrary count, bottom remainder and once-per-turn`, () => {
    const support = card('hSD02-012');
    let tooMany = main(ayameDebut.number);
    tooMany.players[0].hand = [inst(support.number, 'too-many-support'), ...Array.from({ length: 7 }, (_, index) => inst('AUDIT-DUMMY', `extra-${index}`))];
    tooMany.players[0].mainDeck = [inst(ayameDebut.number, 'untouched')];
    assert.throws(() => applyAction(tooMany, 0, { type: 'play', cardId: 'too-many-support' }, pool, () => 0), /手牌不可多於 6/u);
    assert.equal(tooMany.players[0].mainDeck.length, 1, 'invalid hand size must not reveal cards');

    let battle = main(ayameDebut.number);
    battle.players[0].hand = [inst(support.number, 'support-1'), ...Array.from({ length: 6 }, (_, index) => inst('AUDIT-DUMMY', `hand-${index}`))];
    battle.players[0].mainDeck = [inst(fubukiDebut.number, 'fubuki'), inst(mioDebut.number, 'mio'), inst(ayameDebut.number, 'ayame'), inst(nonMatchHolomem.number, 'not-matching'), inst('AUDIT-DUMMY', 'deck-tail')];
    battle = applyAction(battle, 0, { type: 'play', cardId: 'support-1' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'topLookToHand');
    assert.deepEqual(battle.pendingChoice.selectableIds, ['fubuki', 'mio', 'ayame']);
    assert.equal(battle.pendingChoice.min, 0, 'the text permits revealing any number, including none');
    battle = choose(battle, { cardIds: ['fubuki', 'ayame'] });
    assert.deepEqual(battle.players[0].hand.filter(instance => ['fubuki', 'mio', 'ayame'].includes(instance.id)).map(instance => instance.id), ['fubuki', 'ayame']);
    assert.equal(battle.pendingChoice?.effect, 'bottomOrder');
    battle = choose(battle, { cardIds: ['mio', 'not-matching'] });
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['deck-tail', 'mio', 'not-matching']);

    battle.players[0].hand = [inst(support.number, 'support-2'), ...Array.from({ length: 6 }, (_, index) => inst('AUDIT-DUMMY', `repeat-${index}`))];
    assert.throws(() => applyAction(battle, 0, { type: 'play', cardId: 'support-2' }, pool, () => 0), /LIMITED|每回合/u);
  });

  test(`${runtime.name}: hSD02-013 gives all targets +10, Ayame 1st+ gets +20, and duplicate Tools are disallowed`, () => {
    const attachAndAttack = (holomemNumber, id) => {
      let battle = main(holomemNumber);
      battle.players[0].hand = [inst(tool.number, 'tool-1')];
      battle = applyAction(battle, 0, { type: 'play', cardId: 'tool-1' }, pool, () => 0);
      assert.equal(battle.pendingChoice?.type, 'attachSupport');
      battle = choose(battle, { zone: 'center' });
      assert.ok(battle.players[0].zones.center.attachments.some(instance => instance.id === 'tool-1'));
      battle.players[0].hand = [inst(tool.number, 'tool-2')];
      assert.throws(() => applyAction(battle, 0, { type: 'play', cardId: 'tool-2' }, pool, () => 0), /沒有可附加/u);
      battle.phase = 'performance';
      const source = battle.players[0].zones.center;
      fund(source, map.get(holomemNumber).arts[0].cost);
      battle = applyAction(battle, 0, attack, pool, () => 0);
      return battle.players[1].zones.center.damage;
    };
    assert.equal(attachAndAttack('hSD02-002', 'debut'), 40, 'Debut Ayame receives only the base +10');
    assert.equal(attachAndAttack('hSD02-006', 'first'), 50, '1st Ayame receives both +10 clauses');
  });

  test(`${runtime.name}: hSD02-014 grants +20 HP, draws on Ayame Bloom and allows one Mascot per Holomen`, () => {
    let battle = main(ayameDebut.number);
    battle.players[0].hand = [inst(mascot.number, 'mascot-1')];
    battle = applyAction(battle, 0, { type: 'play', cardId: 'mascot-1' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.type, 'attachSupport');
    battle = choose(battle, { zone: 'center' });
    battle.players[0].hand = [inst(mascot.number, 'mascot-2')];
    assert.throws(() => applyAction(battle, 0, { type: 'play', cardId: 'mascot-2' }, pool, () => 0), /沒有可附加/u);

    let damageCheck = state(ayameDebut.number, 'hSD02-005');
    damageCheck.activePlayer = 1;
    damageCheck.phase = 'performance';
    damageCheck.players[0].zones.center.attachments = [inst(mascot.number, 'hp-mascot')];
    damageCheck.players[0].zones.center.damage = 55;
    fund(damageCheck.players[1].zones.center, ['無色']);
    damageCheck = applyAction(damageCheck, 1, { ...attack }, pool, () => 0);
    assert.ok(damageCheck.players[0].zones.center, '20 incoming damage must not knock out the 70 HP Debut with +20 Mascot HP after 55 prior damage');
    assert.equal(damageCheck.players[0].zones.center.damage, 75);

    battle.players[0].hand = [inst('hSD02-006', 'ayame-bloom')];
    battle.players[0].mainDeck = [inst('hSD02-007', 'draw-after-bloom')];
    battle = applyAction(battle, 0, { type: 'play', cardId: 'ayame-bloom' }, pool, () => 0);
    battle = choose(battle, { zone: 'center' });
    assert.deepEqual(battle.players[0].hand.map(instance => instance.id), ['draw-after-bloom']);
    assert.equal(battle.players[0].zones.center.attachments.filter(instance => instance.number === mascot.number).length, 1);
  });
}
