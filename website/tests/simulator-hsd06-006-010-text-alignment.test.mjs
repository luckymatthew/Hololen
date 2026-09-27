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
  const attacker = { ...dummy, number: 'AUDIT-THOUSAND-ATTACKER', hp: 2000, arts: [{ name: 'Audit 1000', damage: 1000, cost: [], effect: '' }] };
  const blue = { ...cards.find(candidate => candidate.group === 'holomem' && candidate.colors.includes('藍')), number: 'AUDIT-BLUE-TARGET', hp: 1000 };
  const red = { ...card('hSD06-009'), number: 'AUDIT-RED-TARGET', hp: 1000 };
  const pool = [...cards, dummy, attacker, blue, red];
  const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);
  const play = (battle, id) => applyAction(battle, 0, { type: 'play', cardId: id }, pool, () => 0);

  test(`${runtime.name}: hSD06-006 Buzz loses two Life on knockout and its Bloom searches either named Mascot then shuffles`, () => {
    const first = card('hSD06-006');
    const debut = card('hSD06-002');
    const chaki = card('hSD06-011');
    const pokobee = card('hSD06-012');
    const decoy = cards.find(candidate => candidate.group === 'support' && ![chaki.number, pokobee.number].includes(candidate.number));
    assert.equal(first.typeCode, 'buzzCharacter');
    assert.match(first.extra, /被擊倒時.*生命值-2/u);
    assert.match(first.keyword.effect, /〈ﾁｬｷ丸〉或〈ぽこべぇ〉.*加入手牌.*洗牌/u);
    assert.deepEqual([first.arts[0].damage, first.arts[0].cost], [50, ['綠', '無色']]);

    let knockout = state(attacker.number, first.number);
    knockout.phase = 'performance';
    knockout.players[0].zones.center = unit(attacker.number);
    knockout.players[1].zones.center = unit(first.number);
    knockout = applyAction(knockout, 0, attack, pool, () => 0);
    assert.equal(knockout.players[1].zones.center, null);
    assert.equal(knockout.players[1].life.length, 3, 'the printed Buzz text loses two Life on its knockout');

    let battle = main(debut.number);
    battle.players[0].hand = [inst(first.number, 'iroha-first')];
    battle.players[0].mainDeck = [inst(chaki.number, 'chaki'), inst(decoy.number, 'wrong-support'), inst(pokobee.number, 'pokobee'), inst(dummy.number, 'tail')];
    battle = play(battle, 'iroha-first');
    battle = choose(battle, { zone: 'center' });
    assert.equal(battle.pendingChoice?.effect, 'deckToHandShuffle');
    assert.deepEqual(new Set(battle.pendingChoice.selectableIds), new Set(['chaki', 'pokobee']));
    battle = choose(battle, { cardIds: ['chaki'] });
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'chaki'));
    assert.ok(battle.players[0].mainDeck.some(instance => instance.id === 'tail'));
  });

  test(`${runtime.name}: hSD06-007 heals only a chosen own #秘密結社holoX Holomen by 30 on Bloom`, () => {
    const first = card('hSD06-007');
    const prior = card('hSD06-006');
    const debut = card('hSD06-008');
    const nonHoloX = card('hSD05-011');
    assert.deepEqual([first.arts[0].damage, first.arts[0].cost], [70, ['綠', '無色', '無色']]);
    assert.match(first.keyword.effect, /#秘密結社holoX.*回復30點HP/u);

    let battle = main();
    battle.players[0].zones.center = unit(prior.number, { damage: 40 });
    battle.players[0].zones.back1 = unit(debut.number, { damage: 40 });
    battle.players[0].zones.collab = unit(nonHoloX.number, { damage: 40 });
    battle.players[0].hand = [inst(first.number, 'iroha-second')];
    battle = play(battle, 'iroha-second');
    assert.ok(battle.pendingChoice?.options.includes('center'));
    battle = choose(battle, { zone: 'center' });
    assert.equal(battle.pendingChoice?.effect, 'heal');
    assert.deepEqual(new Set(battle.pendingChoice.options), new Set(['center', 'back1']));
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.players[0].zones.back1.damage, 10);
    assert.equal(battle.players[0].zones.collab.damage, 40, 'a non-holoX Holomen cannot receive this heal');
  });

  test(`${runtime.name}: hSD06-007 Arts checks the five-stage-Cheer bonus and its separate Blue-target bonus`, () => {
    const iroha = card('hSD06-007');
    assert.ok(blue.number && red.number);
    assert.deepEqual([iroha.arts[0].specialTargets, iroha.arts[0].specialValues], [['藍'], [50]]);
    const hit = (target, backCheerCount) => {
      let battle = main(iroha.number, target.number);
      battle.phase = 'performance';
      battle.players[0].zones.back1 = unit('AUDIT-DUMMY', { cheer: Array.from({ length: backCheerCount }, (_, index) => inst('hY01-001', `back-cheer-${index}`)) });
      fund(battle.players[0].zones.center, iroha.arts[0].cost);
      battle = applyAction(battle, 0, attack, pool, () => 0);
      assert.equal(battle.pendingChoice, null, 'the Bloom heal must not retrigger while resolving an Arts');
      return battle.players[1].zones.center.damage;
    };
    assert.equal(hit(blue, 1), 120, 'four own-stage Cheer plus the Blue-target bonus gives 70+50');
    assert.equal(hit(blue, 2), 170, 'five own-stage Cheer adds another 50');
    assert.equal(hit(red, 2), 120, 'the five-Cheer bonus does not also inherit the Blue-target modifier');
  });

  test(`${runtime.name}: hSD06-008 Collab draws only at five-or-fewer cards with a holoX Center`, () => {
    const koyori = card('hSD06-008');
    const iroha = card('hSD06-002');
    const nonHoloX = card('hSD05-011');
    assert.deepEqual([koyori.arts[0].damage, koyori.arts[0].cost], [10, ['無色']]);
    assert.match(koyori.keyword.effect, /中心Holomen擁有#秘密結社holoX.*手牌在5張以下.*抽1張卡/u);

    const run = (center, handCount, suffix) => {
      let battle = main();
      battle.players[0].zones.center = unit(center.number);
      battle.players[0].zones.back1 = unit(koyori.number);
      battle.players[0].hand = Array.from({ length: handCount }, (_, index) => inst(dummy.number, `${suffix}-hand-${index}`));
      battle.players[0].mainDeck = [inst(dummy.number, `${suffix}-collab-power`), inst(dummy.number, `${suffix}-draw`), inst(dummy.number, `${suffix}-tail`)];
      return applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    };
    const five = run(iroha, 5, 'five');
    assert.ok(five.players[0].hand.some(instance => instance.id === 'five-draw'));
    assert.equal(five.players[0].hand.length, 6);
    assert.equal(run(iroha, 6, 'six').players[0].hand.length, 6);
    assert.equal(run(nonHoloX, 4, 'wrong-center').players[0].hand.length, 4);
  });

  test(`${runtime.name}: hSD06-009 deals 20 Arts for Colorless and optionally recovers only an archived holoX Debut`, () => {
    const lui = card('hSD06-009');
    const legal = card('hSD06-002');
    const wrongStage = card('hSD06-006');
    const wrongTag = card('hSD05-011');
    assert.deepEqual([lui.arts[0].damage, lui.arts[0].cost], [20, ['無色']]);
    assert.match(lui.arts[0].effect, /檔案區域中.*#秘密結社holoX.*Debut.*返回手牌/u);

    let battle = main(lui.number);
    battle.phase = 'performance';
    battle.players[0].archive = [inst(legal.number, 'legal-debut'), inst(wrongStage.number, 'wrong-stage'), inst(wrongTag.number, 'wrong-tag')];
    fund(battle.players[0].zones.center, lui.arts[0].cost);
    battle = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'archiveToHand');
    assert.equal(battle.pendingChoice.optional, true);
    assert.deepEqual(battle.pendingChoice.selectableIds, ['legal-debut']);
    battle = choose(battle, { cardIds: ['legal-debut'] });
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'legal-debut'));
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'wrong-stage'));
    assert.equal(battle.players[1].zones.center.damage, 20);
  });

  test(`${runtime.name}: hSD06-010 gains +50 only from a same-turn SP Oshi skill and may attack only from Collab`, () => {
    const laplus = card('hSD06-010');
    const irohaOshi = card('hSD06-001');
    const center = card('hSD06-002');
    const iroha = card('hSD06-003');
    assert.deepEqual([laplus.arts[0].damage, laplus.arts[0].cost], [30, ['無色']]);
    assert.match(laplus.arts[0].effect, /合作位置限定/u);
    assert.match(laplus.arts[0].effect, /SP推し技能.*Arts\+50/u);

    const attackCollab = spent => {
      let battle = main();
      battle.players[0].oshi = inst(irohaOshi.number);
      battle.players[0].zones.center = unit(center.number);
      battle.players[0].zones.back1 = unit(laplus.number);
      if (spent) {
        battle.players[0].holoPower = [inst(dummy.number, 'sp-cost')];
        battle = applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0);
      }
      battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
      battle.phase = 'performance';
      fund(battle.players[0].zones.collab, laplus.arts[0].cost);
      battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 }, pool, () => 0);
      return battle.players[1].zones.center.damage;
    };
    assert.equal(attackCollab(false), 30);
    assert.equal(attackCollab(true), 80);

    let centerAttack = main(laplus.number);
    centerAttack.phase = 'performance';
    fund(centerAttack.players[0].zones.center, laplus.arts[0].cost);
    assert.throws(() => applyAction(centerAttack, 0, attack, pool, () => 0));
  });
}
