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
  const play = (battle, id) => applyAction(battle, 0, { type: 'play', cardId: id }, pool, () => 0);

  test(`${runtime.name}: hSD03-011 Spot cannot Bloom; both Arts and hand-up-to-three draw align`, () => {
    const laplus = card('hSD03-011');
    const okayu = card('hSD03-002');
    assert.equal(laplus.stage, 'Spot');
    assert.match(laplus.extra, /不能進行Bloom/u);
    assert.deepEqual(laplus.arts.map(art => [art.damage, art.cost]), [[10, ['無色']], [20, ['無色', '無色']]]);

    let illegalBloom = main(okayu.number);
    illegalBloom.players[0].hand = [inst(laplus.number, 'laplus-spot')];
    illegalBloom = play(illegalBloom, 'laplus-spot');
    assert.equal(illegalBloom.pendingChoice?.type, 'playHolomen');
    assert.ok(!illegalBloom.pendingChoice.options.includes('center'));
    assert.throws(() => choose(illegalBloom, { zone: 'center' }), /舞台位置|不可/u);
    illegalBloom = choose(illegalBloom, { zone: 'back1' });
    assert.equal(illegalBloom.players[0].zones.back1.stack.at(-1).number, laplus.number);

    const perform = initialHand => {
      let battle = performance(laplus.number);
      battle.players[0].hand = Array.from({ length: initialHand }, (_, index) => inst('AUDIT-DUMMY', `held-${initialHand}-${index}`));
      battle.players[0].mainDeck = Array.from({ length: 4 }, (_, index) => inst('AUDIT-DUMMY', `draw-${initialHand}-${index}`));
      fund(battle.players[0].zones.center, laplus.arts[1].cost);
      battle = applyAction(battle, 0, { ...attack, artIndex: 1 }, pool, () => 0);
      assert.equal(battle.players[1].zones.center.damage, 20);
      return battle;
    };
    const empty = perform(0);
    assert.deepEqual(empty.players[0].hand.map(instance => instance.id), ['draw-0-0', 'draw-0-1', 'draw-0-2']);
    const two = perform(2);
    assert.equal(two.players[0].hand.length, 3, 'two-card hand draws exactly one');
    assert.deepEqual(two.players[0].hand.map(instance => instance.id), ['held-2-0', 'held-2-1', 'draw-2-0']);
    const three = perform(3);
    assert.equal(three.players[0].hand.length, 3, 'a three-card hand draws none');
    assert.equal(three.players[0].mainDeck.length, 4);
  });

  test(`${runtime.name}: hSD03-012 LIMITED event enforces six-card hand cap, searches only the six named groups and bottoms remainder in chosen order`, () => {
    const support = card('hSD03-012');
    const allowedNames = ['猫又おかゆ', '鷹嶺ルイ', '大神ミオ', '白上フブキ', 'ラプラス・ダークネス', '戌神ころね'];
    const okayu = card('hSD03-002');
    const lui = cards.find(candidate => candidate.group === 'holomem' && containsName(candidate, '鷹嶺ルイ'));
    const mio = cards.find(candidate => candidate.group === 'holomem' && containsName(candidate, '大神ミオ'));
    const nonmatches = cards.filter(candidate => candidate.group === 'holomem' && !allowedNames.some(name => containsName(candidate, name)));
    assert.ok(support && lui && mio && nonmatches.length >= 2, 'catalog needs named and non-matching Holomen');
    assert.equal(support.typeCode, 'supportEventLimited');
    assert.match(support.abilityText, /6張以下/u);
    assert.match(support.abilityText, /牌庫頂的4張/u);
    assert.match(support.abilityText, /每回合只能使用1張/u);

    let blocked = main();
    blocked.players[0].hand = [inst(support.number, 'too-many-support'), ...Array.from({ length: 7 }, (_, index) => inst('AUDIT-DUMMY', `extra-${index}`))];
    blocked.players[0].mainDeck = [inst(okayu.number, 'unseen')];
    assert.throws(() => play(blocked, 'too-many-support'), /手牌不可多於 6/u);
    assert.equal(blocked.players[0].mainDeck.length, 1, 'illegal hand size cannot reveal or move the deck');

    let battle = main();
    battle.players[0].hand = [inst(support.number, 'support-1'), inst(support.number, 'support-2'), ...Array.from({ length: 4 }, (_, index) => inst('AUDIT-DUMMY', `held-${index}`))];
    battle.players[0].mainDeck = [inst(okayu.number, 'okayu'), inst(lui.number, 'lui'), inst(nonmatches[0].number, 'unmatched'), inst(mio.number, 'mio'), inst(nonmatches[1].number, 'tail')];
    battle = play(battle, 'support-1');
    assert.equal(battle.pendingChoice?.effect, 'topLookToHand');
    assert.equal(battle.pendingChoice.min, 0, 'any number may be selected, including zero');
    assert.deepEqual(new Set(battle.pendingChoice.selectableIds), new Set(['okayu', 'lui', 'mio']));
    battle = choose(battle, { cardIds: ['okayu', 'lui'] });
    assert.equal(battle.pendingChoice?.effect, 'bottomOrder');
    battle = choose(battle, { cardIds: ['mio', 'unmatched'] });
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['tail', 'mio', 'unmatched']);
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'okayu'));
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'lui'));
    assert.equal(battle.players[0].limitedUsesCount, 1);
    assert.throws(() => play(battle, 'support-2'), /LIMITED|每回合|最多只可使用/u);

    let zeroChoice = main();
    zeroChoice.players[0].hand = [inst(support.number, 'zero-choice')];
    zeroChoice.players[0].mainDeck = ['filler-1', 'filler-2', 'filler-3', 'filler-4'].map(id => inst('AUDIT-DUMMY', id));
    zeroChoice = play(zeroChoice, 'zero-choice');
    assert.equal(zeroChoice.pendingChoice?.effect, 'bottomOrder', 'when no card matches, the full reveal goes to bottom ordering');
    zeroChoice = choose(zeroChoice, { cardIds: ['filler-3', 'filler-1', 'filler-4', 'filler-2'] });
    assert.deepEqual(zeroChoice.players[0].mainDeck.map(instance => instance.id), ['filler-3', 'filler-1', 'filler-4', 'filler-2']);
  });

  test(`${runtime.name}: hSD03-013 mascot reduces damage by 10 at Center/Collab only and substitutes for Okayu's ability archive`, () => {
    const mascot = card('hSD03-013');
    const okayu = card('hSD03-006');
    assert.match(mascot.abilityText, /受到的傷害減少10/u);
    assert.match(mascot.abilityText, /猫又おかゆ/u);
    assert.match(mascot.abilityText, /只能附著1張吉祥物/u);

    for (const zone of ['center', 'collab']) {
      let battle = state('AUDIT-DUMMY', 'AUDIT-DUMMY');
      battle.phase = 'performance';
      battle.activePlayer = 1;
      battle.players[0].zones[zone] = unit('AUDIT-DUMMY', { attachments: [inst(mascot.number, `mascot-${zone}`)] });
      fund(battle.players[1].zones.center, ['無色']);
      battle = applyAction(battle, 1, { ...attack, targetZone: zone }, pool, () => 0);
      assert.equal(battle.players[0].zones[zone].damage, 90, `${zone} receives 100 Arts damage minus 10`);
    }

    let backDamage = main('hSD03-002');
    backDamage.players[0].zones.back1 = unit('hSD03-003');
    backDamage.players[1].zones.center = unit('AUDIT-DUMMY');
    backDamage.players[1].zones.back1 = unit('AUDIT-DUMMY', { attachments: [inst(mascot.number, 'mascot-back')] });
    backDamage = applyAction(backDamage, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(backDamage.pendingChoice?.effect, 'specialDamage');
    backDamage = choose(backDamage, { zone: 'back1' });
    assert.equal(backDamage.players[1].zones.back1.damage, 10, 'Back position receives full special damage because the mascot protects Center/Collab only');

    let duplicate = main('AUDIT-DUMMY');
    duplicate.players[0].zones.center.attachments = [inst(mascot.number, 'first-mascot')];
    duplicate.players[0].hand = [inst(mascot.number, 'second-mascot')];
    assert.throws(() => play(duplicate, 'second-mascot'), /沒有可附加/u);

    let substitution = performance(okayu.number);
    substitution.players[0].zones.center.cheer = [inst('hY04-001', 'arts-blue'), inst('hY01-001', 'arts-colorless'), inst('hY04-001', 'effect-blue')];
    substitution.players[0].zones.center.attachments = [inst(mascot.number, 'mascot-substitute')];
    substitution.players[1].zones.back1 = unit('AUDIT-DUMMY');
    substitution = applyAction(substitution, 0, { ...attack, artIndex: 1 }, pool, () => 0);
    assert.equal(substitution.pendingChoice?.effect, 'genericKeywordCheerCost');
    assert.ok(substitution.pendingChoice.cheerOptions.some(option => option.id === 'mascot-substitute' && option.cheerSubstitute));
    substitution = choose(substitution, { cheerId: 'mascot-substitute' });
    assert.ok(substitution.players[0].archive.some(instance => instance.id === 'mascot-substitute'));
    assert.ok(!substitution.players[0].zones.center.attachments.some(instance => instance.id === 'mascot-substitute'));
    assert.ok(substitution.players[0].zones.center.cheer.some(instance => instance.id === 'effect-blue'), 'the Mascot substitutes for archiving a Blue Cheer');
    assert.equal(substitution.pendingChoice?.effect, 'specialDamage');
  });

  test(`${runtime.name}: hSD03-014 Fan attaches only to own Okayu, stacks without a per-character limit and grants +10 HP each`, () => {
    const fan = card('hSD03-014');
    const okayu = card('hSD03-002');
    const nonOkayu = cards.find(candidate => candidate.group === 'holomem' && !containsName(candidate, '猫又おかゆ'));
    const attacker = card('hSD03-011');
    assert.match(fan.abilityText, /HP\+10/u);
    assert.match(fan.abilityText, /只能附加在自己的〈猫又おかゆ〉上/u);
    assert.match(fan.abilityText, /不限張數/u);
    assert.ok(nonOkayu && attacker);

    let invalidTarget = main(nonOkayu.number);
    invalidTarget.players[0].zones.back1 = unit('AUDIT-DUMMY');
    invalidTarget.players[0].hand = [inst(fan.number, 'fan-invalid')];
    assert.throws(() => play(invalidTarget, 'fan-invalid'), /沒有可附加/u);

    let battle = main(okayu.number);
    battle.players[0].zones.back1 = unit(nonOkayu.number);
    battle.players[0].hand = [inst(fan.number, 'fan-1')];
    battle = play(battle, 'fan-1');
    assert.deepEqual(battle.pendingChoice?.options, ['center'], 'the non-Okayu Back Holomen is not offered');
    battle = choose(battle, { zone: 'center' });
    battle.players[0].hand = [inst(fan.number, 'fan-2')];
    battle = play(battle, 'fan-2');
    assert.deepEqual(battle.pendingChoice?.options, ['center'], 'a Fan does not consume the one-Mascot/Tool attachment slot');
    battle = choose(battle, { zone: 'center' });
    assert.equal(battle.players[0].zones.center.attachments.filter(instance => instance.number === fan.number).length, 2);

    let damageCheck = state(okayu.number, attacker.number);
    damageCheck.phase = 'performance';
    damageCheck.activePlayer = 1;
    damageCheck.players[0].zones.center.attachments = [inst(fan.number, 'fan-a'), inst(fan.number, 'fan-b')];
    damageCheck.players[0].zones.center.damage = 70;
    fund(damageCheck.players[1].zones.center, attacker.arts[0].cost);
    damageCheck = applyAction(damageCheck, 1, { ...attack, artIndex: 0 }, pool, () => 0);
    assert.ok(damageCheck.players[0].zones.center, 'two Fans raise Okayu from 70 to 90 HP, so she survives at 80 damage');
    assert.equal(damageCheck.players[0].zones.center.damage, 80);
  });
}
