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

const main = (source = 'AUDIT-DUMMY', target = 'AUDIT-DUMMY') => {
  const battle = state(source, target);
  battle.phase = 'main';
  return battle;
};

for (const runtime of runtimes) {
  const { cards, applyAction } = runtime;
  const card = number => cards.find(candidate => candidate.number === number);
  const attacker = { ...dummy, number: 'AUDIT-TWENTY-ATTACKER', hp: 1000, arts: [{ name: 'Audit 20', damage: 20, cost: [], effect: '' }] };
  const pool = [...cards, dummy, attacker];
  const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);
  const collab = (battle, zone) => applyAction(battle, 0, { type: 'collab', zone }, pool, () => 0);
  const play = (battle, id) => applyAction(battle, 0, { type: 'play', cardId: id }, pool, () => 0);

  test(`${runtime.name}: hSD05-011 draws only at five-or-fewer cards with a #ReGLOSS Center`, () => {
    const ririka = card('hSD05-011');
    const center = card('hSD05-004');
    const nonRegloss = card('hSD04-005');
    assert.deepEqual([ririka.arts[0].damage, ririka.arts[0].cost], [20, ['無色']]);
    assert.match(ririka.keyword.effect, /中心Holomen擁有#ReGLOSS.*手牌在5張以下，抽1張卡/u);

    let battle = main();
    battle.players[0].zones.center = unit(center.number);
    battle.players[0].zones.back1 = unit(ririka.number);
    battle.players[0].hand = Array.from({ length: 5 }, (_, index) => inst(dummy.number, `hand-${index}`));
    battle.players[0].mainDeck = [inst(dummy.number, 'collab-power'), inst(dummy.number, 'drawn'), inst(dummy.number, 'tail')];
    battle = collab(battle, 'back1');
    assert.equal(battle.players[0].hand.length, 6);
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'drawn'));
    assert.ok(battle.players[0].holoPower.some(instance => instance.id === 'collab-power'));

    let fullHand = main();
    fullHand.players[0].zones.center = unit(center.number);
    fullHand.players[0].zones.back1 = unit(ririka.number);
    fullHand.players[0].hand = Array.from({ length: 6 }, (_, index) => inst(dummy.number, `full-${index}`));
    fullHand.players[0].mainDeck = [inst(dummy.number, 'full-collab-power'), inst(dummy.number, 'not-drawn')];
    fullHand = collab(fullHand, 'back1');
    assert.equal(fullHand.players[0].hand.length, 6, 'six cards do not satisfy the printed at-most-five gate');
    assert.ok(!fullHand.players[0].hand.some(instance => instance.id === 'not-drawn'));

    let wrongCenter = main();
    assert.ok(!nonRegloss.tags.includes('#ReGLOSS'));
    wrongCenter.players[0].zones.center = unit(nonRegloss.number);
    wrongCenter.players[0].zones.back1 = unit(ririka.number);
    wrongCenter.players[0].hand = Array.from({ length: 4 }, (_, index) => inst(dummy.number, `wrong-center-${index}`));
    wrongCenter.players[0].mainDeck = [inst(dummy.number, 'wrong-center-power'), inst(dummy.number, 'wrong-center-not-drawn')];
    wrongCenter = collab(wrongCenter, 'back1');
    assert.equal(wrongCenter.players[0].hand.length, 4, 'a non-#ReGLOSS Center does not trigger the draw');
  });

  test(`${runtime.name}: hSD05-012 Collab deals 10 special damage to an opponent Center or Back, not Collab`, () => {
    const ao = card('hSD05-012');
    const center = card('hSD05-004');
    const back = card('hSD05-006');
    const opposingCollab = card('hSD05-008');
    assert.deepEqual([ao.arts[0].damage, ao.arts[0].cost], [20, ['無色']]);
    assert.match(ao.keyword.effect, /中央Holo成員或後排Holo成員1人.*10點特殊傷害/u);

    let battle = main();
    battle.players[0].zones.back1 = unit(ao.number);
    battle.players[1].zones.center = unit(center.number);
    battle.players[1].zones.back2 = unit(back.number);
    battle.players[1].zones.collab = unit(opposingCollab.number);
    battle.players[1].life = Array.from({ length: 5 }, (_, index) => inst(dummy.number, `life-${index}`));
    battle.players[0].mainDeck = [inst(dummy.number, 'collab-power'), inst(dummy.number, 'tail')];
    battle = collab(battle, 'back1');
    assert.equal(battle.pendingChoice?.effect, 'specialDamage');
    assert.deepEqual(new Set(battle.pendingChoice.options), new Set(['center', 'back2']));
    battle = choose(battle, { zone: 'back2' });
    assert.equal(battle.players[1].zones.back2.damage, 10);
    assert.equal(battle.players[1].zones.center.damage, 0);
    assert.equal(battle.players[1].zones.collab.damage, 0);
    assert.equal(battle.players[1].life.length, 5, 'non-lethal special damage does not change Life');
  });

  test(`${runtime.name}: hSD05-013 can move a stage Cheer to another own Holomen but never back to its Collab source`, () => {
    const kanade = card('hSD05-013');
    const cheer = cards.find(candidate => candidate.group === 'cheer');
    const receiver = card('hSD05-010');
    assert.ok(cheer && receiver);
    assert.deepEqual([kanade.arts[0].damage, kanade.arts[0].cost], [20, ['無色']]);
    assert.match(kanade.keyword.effect, /轉移給除這位Holomen以外的自己的Holomen/u);

    let battle = main();
    battle.players[0].zones.center = unit(card('hSD05-004').number, { cheer: [inst(cheer.number, 'movable-cheer')] });
    battle.players[0].zones.back1 = unit(kanade.number);
    battle.players[0].zones.back2 = unit(receiver.number);
    battle.players[0].mainDeck = [inst(dummy.number, 'collab-power'), inst(dummy.number, 'tail')];
    battle = collab(battle, 'back1');
    assert.equal(battle.pendingChoice?.effect, 'genericMoveCheer');
    assert.deepEqual(battle.pendingChoice.options, ['movable-cheer']);
    battle = choose(battle, { cheerId: 'movable-cheer' });
    assert.equal(battle.pendingChoice?.effect, 'genericReceiveMovedCheer');
    assert.ok(!battle.pendingChoice.options.includes('collab'), 'the Cheer recipient cannot be the hSD05-013 that caused the effect');
    assert.ok(battle.pendingChoice.options.includes('back2'));
    battle = choose(battle, { zone: 'back2' });
    assert.equal(battle.players[0].zones.back2.cheer[0]?.id, 'movable-cheer');
    assert.equal(battle.players[0].zones.collab.cheer.length, 0);
    assert.equal(battle.players[0].zones.center.cheer.length, 0);
  });

  test(`${runtime.name}: hSD05-014 grants Arts +10, conditional Bancho HP +20, and one mascot per Holomen`, () => {
    const mascot = card('hSD05-014');
    const bancho = card('hSD05-006');
    const other = card('hSD05-011');
    assert.equal(mascot.typeCode, 'supportMascot');
    assert.match(mascot.abilityText, /所在的Holomen，其Arts\+10/u);
    assert.match(mascot.abilityText, /若裝備在〈轟はじめ〉身上[\s\S]*HP\+20/u);
    assert.match(mascot.abilityText, /每位自己的Holomen只能裝備1張/u);

    let battle = main();
    battle.players[0].zones.center = unit(bancho.number);
    battle.players[0].zones.back1 = unit(other.number);
    battle.players[0].hand = [inst(mascot.number, 'mascot-bancho'), inst(mascot.number, 'mascot-other')];
    battle = play(battle, 'mascot-bancho');
    assert.deepEqual(battle.pendingChoice?.options, ['center', 'back1']);
    battle = choose(battle, { zone: 'center' });
    assert.ok(battle.players[0].zones.center.attachments.some(instance => instance.id === 'mascot-bancho'));
    battle = play(battle, 'mascot-other');
    assert.deepEqual(battle.pendingChoice?.options, ['back1'], 'the mascot slot is limited independently for each Holomen');
    battle = choose(battle, { zone: 'back1' });

    let arts = main(bancho.number);
    arts.phase = 'performance';
    arts.players[0].zones.center.attachments = [inst(mascot.number, 'arts-mascot')];
    fund(arts.players[0].zones.center, bancho.arts[0].cost);
    arts = applyAction(arts, 0, attack, pool, () => 0);
    assert.equal(arts.players[1].zones.center.damage, Number(bancho.arts[0].damage) + 10);

    const damageWithMascot = target => {
      const battleState = state(attacker.number, target.number);
      battleState.phase = 'performance';
      battleState.activePlayer = 0;
      battleState.players[1].zones.center = unit(target.number, {
        damage: Number(target.hp) - 20,
        attachments: [inst(mascot.number, 'hp-check')],
      });
      battleState.players[0].zones.center = unit(attacker.number);
      return applyAction(battleState, 0, attack, pool, () => 0);
    };
    assert.ok(damageWithMascot(bancho).players[1].zones.center, 'Bancho survives 20 damage because of the conditional HP bonus');
    assert.equal(damageWithMascot(other).players[1].zones.center, null, 'the same mascot gives no HP bonus to a non-Bancho Holomen');
  });
}
