import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, fund, inst, state, unit } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const cards = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, cards });
}

for (const runtime of runtimes) {
  const { applyAction, cards } = runtime;
  const card = number => cards.find(candidate => candidate.number === number);
  const oshi = card('hSD08-001');
  const debutSummer = card('hSD08-002');
  const bloomSearch = card('hSD08-003');
  const centerGift = card('hSD08-004');
  const lunaGift = card('hSD08-005');
  const towa = card('hSD08-006');
  const watame = card('hSD08-007');
  const whiteBasic = cards.find(candidate => candidate.group === 'holomem'
    && candidate.colors?.includes('白') && candidate.arts?.[0]?.damage > 0
    && !candidate.arts[0].effect && !(candidate.arts[0].specialTargets || []).length);
  const summerMembers = cards.filter(candidate => candidate.group === 'holomem' && candidate.tags?.includes('#サマー'));
  const fourthGenDebut = cards.find(candidate => candidate.group === 'holomem' && candidate.stage === 'Debut' && candidate.tags?.includes('#4期生'));
  const fourthGenSecond = cards.find(candidate => candidate.group === 'holomem' && candidate.stage === '2nd' && candidate.tags?.includes('#4期生'));
  const otherSecond = cards.find(candidate => candidate.group === 'holomem' && candidate.stage === '2nd' && !candidate.tags?.includes('#4期生'));
  const greenTarget = cards.find(candidate => candidate.group === 'holomem' && candidate.colors?.includes('綠') && candidate.hp >= 200 && candidate.keyword?.type !== 'gift');
  const pcItems = ['hBP01-103', 'hBP01-104'].map(card);
  const otherItem = cards.find(candidate => ['supportItem', 'supportItemLimited'].includes(candidate.typeCode)
    && ![candidate.name, candidate.jpName, candidate.enName].some(name => /パソコン|電腦/u.test(String(name || ''))));
  const hitter = { ...dummy, number: 'AUDIT-HSD08-HITTER', hp: 10000, arts: [{ name: 'Audit hit', damage: 70, cost: [], effect: '' }] };
  const knockoutHitter = { ...hitter, number: 'AUDIT-HSD08-KO-HITTER', arts: [{ name: 'Audit knockout', damage: 150, cost: [], effect: '' }] };
  const redCenter = { ...dummy, number: 'AUDIT-HSD08-RED-CENTER', hp: 170, colors: ['紅'], arts: [] };
  const redCenterSurvivor = { ...redCenter, number: 'AUDIT-HSD08-RED-SURVIVOR', hp: 171 };
  const secondTarget = { ...dummy, number: 'AUDIT-HSD08-SECOND', stage: '2nd', hp: 200, tags: [] };
  const debutDecoy = { ...dummy, number: 'AUDIT-HSD08-DEBUT-DECOY', stage: 'Debut', hp: 100 };
  const pool = [...cards, dummy, hitter, knockoutHitter, redCenter, redCenterSurvivor, secondTarget, debutDecoy];
  const choose = (battle, playerIndex, action) => applyAction(battle, playerIndex, { type: 'choose', ...action }, pool, () => 0);
  const main = (source = dummy.number, target = dummy.number) => {
    const battle = state(source, target);
    battle.phase = 'main';
    return battle;
  };

  test(`${runtime.name}: hSD08-001 normal Oshi skill pays two, buffs only a White Center by 20, and is once per turn`, () => {
    assert.ok(whiteBasic, 'catalogue provides a White Holomen with an uncomplicated Arts');
    assert.match(oshi.oshiSkill.timing, /Holo Power -2/u);
    assert.match(oshi.oshiSkill.effect, /白色中心Holomen的Arts\+20/u);
    let battle = main(whiteBasic.number);
    battle.players[0].oshi = inst(oshi.number);
    battle.players[0].holoPower = [inst(dummy.number, 'power-a'), inst(dummy.number, 'power-b')];
    battle = applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0);
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.deepEqual(battle.players[0].archive.map(instance => instance.id), ['power-b', 'power-a']);
    assert.equal(battle.players[0].oshiSkillTurn, battle.turn);
    assert.throws(() => applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0), /本回合已使用過推し技能/u);
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, whiteBasic.arts[0].cost);
    battle.players[1].zones.center = unit(dummy.number);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, whiteBasic.arts[0].damage + 20);
  });

  test(`${runtime.name}: hSD08-001 SP reaction pays one and reduces opponent Arts damage to a White Holomen by 20`, () => {
    const whiteTarget = cards.find(candidate => candidate.group === 'holomem' && candidate.colors?.includes('白') && candidate.hp >= 150);
    assert.ok(whiteTarget);
    let battle = state(hitter.number, whiteTarget.number);
    battle.phase = 'performance';
    battle.players[0].zones.center = unit(hitter.number);
    battle.players[1].oshi = inst(oshi.number);
    battle.players[1].holoPower = [inst(dummy.number, 'sp-power')];
    battle.players[1].zones.center = unit(whiteTarget.number);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'oshiDamageReaction');
    assert.ok(battle.pendingChoice.modeOptions.some(option => option.id === 'sp:20'));
    battle = choose(battle, 1, { optionId: 'sp:20' });
    assert.equal(battle.players[1].zones.center.damage, 50);
    assert.equal(battle.players[1].holoPower.length, 0);
    assert.equal(battle.players[1].spOshiSkillUsed, true);
  });

  test(`${runtime.name}: hSD08-002 Arts is 20 for Colorless; Collab takes one #Summer Debut from the top five and bottoms the rest`, () => {
    assert.deepEqual([debutSummer.arts[0].damage, debutSummer.arts[0].cost], [20, ['無色']]);
    let artBattle = state(debutSummer.number, dummy.number);
    artBattle.phase = 'performance';
    artBattle.players[0].zones.center = unit(debutSummer.number);
    fund(artBattle.players[0].zones.center, debutSummer.arts[0].cost);
    artBattle.players[1].zones.center = unit(dummy.number);
    artBattle = applyAction(artBattle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(artBattle.players[1].zones.center.damage, 20);

    const summer = cards.find(candidate => candidate.group === 'holomem' && candidate.stage === 'Debut' && candidate.tags?.includes('#サマー'));
    assert.ok(summer);
    let battle = main(dummy.number);
    battle.players[0].zones.back1 = unit(debutSummer.number);
    battle.players[0].mainDeck = [inst(dummy.number, 'collab-power'), inst(dummy.number, 'top-a'), inst(summer.number, 'summer-match'), inst(dummy.number, 'top-c'), inst(dummy.number, 'top-d'), inst(dummy.number, 'top-e'), inst(summer.number, 'outside-top-five')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.min, 1);
    assert.equal(battle.pendingChoice?.max, 1);
    assert.equal(battle.pendingChoice?.optional, false);
    assert.deepEqual(battle.pendingChoice.selectableIds, ['summer-match']);
    battle = choose(battle, 0, { cardIds: ['summer-match'] });
    assert.equal(battle.players[0].hand.at(-1).id, 'summer-match');
    assert.equal(battle.pendingChoice?.effect, 'bottomOrder');
    battle = choose(battle, 0, { cardIds: ['top-d', 'top-a', 'top-e', 'top-c'] });
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['outside-top-five', 'top-d', 'top-a', 'top-e', 'top-c']);
  });

  test(`${runtime.name}: hSD08-003 Bloom finds a #4期生 Debut, adds it and shuffles; Arts scale by own #Summer Holomen`, () => {
    assert.ok(fourthGenDebut);
    assert.ok(summerMembers.length >= 2);
    const firstStage = cards.find(candidate => candidate.group === 'holomem' && candidate.jpName === bloomSearch.jpName && candidate.stage === '1st');
    assert.ok(firstStage, 'the printed 2nd-stage Bloom has a same-name 1st-stage predecessor');
    let battle = main(firstStage.number);
    battle.players[0].hand = [inst(bloomSearch.number, 'bloom-2nd')];
    battle.players[0].mainDeck = [inst(fourthGenDebut.number, 'fourth-gen'), inst(dummy.number, 'rest-one'), inst(dummy.number, 'rest-two'), inst(dummy.number, 'rest-three')];
    battle = applyAction(battle, 0, { type: 'play', cardId: 'bloom-2nd' }, pool, () => 0);
    battle = choose(battle, 0, { zone: 'center' });
    assert.equal(battle.pendingChoice?.effect, 'deckToHandShuffle');
    assert.ok(battle.pendingChoice.cards.some(instance => instance.id === 'fourth-gen'));
    battle = choose(battle, 0, { cardIds: ['fourth-gen'] });
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'fourth-gen'));
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['rest-two', 'rest-three', 'rest-one']);

    const art = bloomSearch.arts[0];
    assert.match(art.effect, /每有1位持有#サマー的Holomem.*\+10/u);
    const summerUnitNumbers = [bloomSearch.number, summerMembers[0].number, summerMembers[1].number];
    const summerCount = summerUnitNumbers.filter(number => card(number).tags?.includes('#サマー')).length;
    battle = state(bloomSearch.number, greenTarget.number);
    battle.phase = 'performance';
    battle.players[0].zones.center = unit(bloomSearch.number);
    battle.players[0].zones.back1 = unit(summerMembers[0].number);
    battle.players[0].zones.back2 = unit(summerMembers[1].number);
    fund(battle.players[0].zones.center, art.cost);
    battle.players[1].zones.center = unit(greenTarget.number);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    const targetBonus = art.specialTargets.reduce((sum, color, index) => sum + (greenTarget.colors.includes(color) ? art.specialValues[index] : 0), 0);
    assert.equal(battle.players[1].zones.center.damage, art.damage + targetBonus + summerCount * 10);
  });

  test(`${runtime.name}: hSD08-004 Center Gift grants +40 only to own Collab #4期生 Debut Arts`, () => {
    assert.match(centerGift.keyword.effect, /僅限中心位置/u);
    let battle = state(centerGift.number, dummy.number);
    battle.phase = 'performance';
    battle.players[0].zones.center = unit(centerGift.number);
    battle.players[0].zones.collab = unit(fourthGenDebut.number);
    fund(battle.players[0].zones.collab, fourthGenDebut.arts[0].cost);
    battle.players[1].zones.center = unit(dummy.number);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, fourthGenDebut.arts[0].damage + 40);
  });

  test(`${runtime.name}: hSD08-004 Arts deals Red-target bonus damage, then on Center KO hits only an opposing 2nd`, () => {
    assert.match(centerGift.arts[0].effect, /每回合1次.*讓對手的中心Holomen倒下.*1位2nd Holomen.*40點特殊傷害/u);
    let battle = state(centerGift.number, redCenter.number);
    battle.phase = 'performance';
    battle.players[0].zones.center = unit(centerGift.number);
    fund(battle.players[0].zones.center, centerGift.arts[0].cost);
    battle.players[1].zones.center = unit(redCenter.number);
    battle.players[1].zones.back1 = unit(secondTarget.number);
    battle.players[1].zones.back2 = unit(debutDecoy.number);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center, null, '120 base + 50 Red bonus defeats the 170 HP Center');
    assert.equal(battle.players[1].life.length, 4);
    if (battle.pendingChoice?.type === 'lifeCheerTarget') battle = choose(battle, 1, { zone: 'back1' });
    assert.equal(battle.pendingChoice?.effect, 'specialDamage');
    assert.deepEqual(battle.pendingChoice.options, ['back1']);
    battle = choose(battle, 0, { zone: 'back1' });
    assert.equal(battle.players[1].zones.back1.damage, 40);
    assert.equal(battle.players[1].zones.back2.damage, 0);

    let noKo = state(centerGift.number, redCenterSurvivor.number);
    noKo.phase = 'performance';
    noKo.players[0].zones.center = unit(centerGift.number);
    fund(noKo.players[0].zones.center, centerGift.arts[0].cost);
    noKo.players[1].zones.center = unit(redCenterSurvivor.number);
    noKo.players[1].zones.back1 = unit(secondTarget.number);
    noKo = applyAction(noKo, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(noKo.players[1].zones.center.damage, 170);
    assert.equal(noKo.players[1].zones.back1.damage, 0, 'without a Center knockout, the additional special damage does not happen');
  });

  test(`${runtime.name}: hSD08-005 Collab Gift returns a matching regular or LIMITED PC item only when Life is not greater`, () => {
    assert.ok(pcItems.every(Boolean));
    assert.match(lunaGift.keyword.effect, /合作位置限定.*對手的回合.*生命值小於或等於對手.*パソコン/u);
    const resolveDownChoices = (initial, selectedPcId = '') => {
      let battle = initial;
      let offered = null;
      for (let count = 0; battle.pendingChoice && count < 8; count += 1) {
        if (battle.pendingChoice.type === 'lifeCheerTarget') battle = choose(battle, 1, { zone: 'collab' });
        else if (battle.pendingChoice.effect === 'archiveToHand') {
          offered = battle.pendingChoice;
          if (selectedPcId) battle = choose(battle, 1, { cardIds: [selectedPcId] });
          else break;
        } else throw new Error(`Unexpected hSD08-005 follow-up: ${battle.pendingChoice.effect}`);
      }
      return { battle, offered };
    };
    const hitLuna = (ownerLife, opponentLife) => {
      let battle = state(knockoutHitter.number, debutDecoy.number);
      battle.phase = 'performance';
      battle.players[0].zones.center = unit(knockoutHitter.number);
      battle.players[0].life = battle.players[0].life.slice(0, opponentLife);
      battle.players[1].life = battle.players[1].life.slice(0, ownerLife);
      battle.players[1].zones.center = unit(debutDecoy.number);
      battle.players[1].zones.collab = unit(lunaGift.number);
      battle.players[1].archive = [...pcItems.map((item, index) => inst(item.number, `pc-${index}`)), inst(otherItem.number, 'non-pc-item')];
      battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
      return battle;
    };
    const positive = resolveDownChoices(hitLuna(5, 5), 'pc-0');
    assert.deepEqual(new Set(positive.offered.cards.map(instance => instance.id)), new Set(['pc-0', 'pc-1']));
    assert.ok(positive.battle.players[1].hand.some(instance => instance.id === 'pc-0'));
    assert.ok(positive.battle.players[1].archive.some(instance => instance.id === 'non-pc-item'));
    assert.equal(positive.battle.players[1].life.length, 4, 'Life comparison is checked after the knockout life loss');

    const negative = resolveDownChoices(hitLuna(4, 2));
    assert.equal(negative.offered, null, 'Life greater than the opponent does not offer the Archive recovery');
    assert.equal(negative.battle.players[1].hand.some(instance => instance.id.startsWith('pc-')), false);
  });

  test(`${runtime.name}: hSD08-006 Arts is 20 for Colorless; Collab deals 20 only on second player's first turn, otherwise 10`, () => {
    assert.deepEqual([towa.arts[0].damage, towa.arts[0].cost], [20, ['無色']]);
    const collabDamage = ({ ownerIndex, turnsTaken, firstPlayer }) => {
      let battle = main();
      battle.firstPlayer = firstPlayer;
      battle.activePlayer = ownerIndex;
      battle.players[ownerIndex].turnsTaken = turnsTaken;
      battle.players[ownerIndex].zones.back1 = unit(towa.number);
      battle.players[1 - ownerIndex].zones.center = unit(dummy.number);
      battle = applyAction(battle, ownerIndex, { type: 'collab', zone: 'back1' }, pool, () => 0);
      return battle.players[1 - ownerIndex].zones.center.damage;
    };
    assert.equal(collabDamage({ ownerIndex: 1, turnsTaken: 1, firstPlayer: 0 }), 20);
    assert.equal(collabDamage({ ownerIndex: 1, turnsTaken: 2, firstPlayer: 0 }), 10);
    assert.equal(collabDamage({ ownerIndex: 0, turnsTaken: 1, firstPlayer: 0 }), 10);
  });

  test(`${runtime.name}: hSD08-007 Arts is 10 for Colorless; Collab optionally attaches Archive Cheer only to own #4期生 2nd`, () => {
    assert.deepEqual([watame.arts[0].damage, watame.arts[0].cost], [10, ['無色']]);
    assert.ok(fourthGenSecond && otherSecond);
    let battle = main(fourthGenSecond.number);
    battle.players[0].zones.back1 = unit(watame.number);
    battle.players[0].zones.back2 = unit(otherSecond.number);
    battle.players[0].archive = [inst('hY01-001', 'archive-cheer')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'archiveCheerToStage');
    assert.equal(battle.pendingChoice.optional, true);
    assert.deepEqual(battle.pendingChoice.cards.map(instance => instance.id), ['archive-cheer']);
    battle = choose(battle, 0, { cardIds: ['archive-cheer'] });
    assert.deepEqual(battle.pendingChoice.options, ['center']);
    battle = choose(battle, 0, { zone: 'center' });
    assert.equal(battle.players[0].zones.center.cheer[0].id, 'archive-cheer');
    assert.equal(battle.players[0].zones.back2.cheer.length, 0);
  });
}
