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
  const { cards, applyAction } = runtime;
  const card = number => cards.find(candidate => candidate.number === number);
  const flareSearch = card('hSD07-006');
  const flareSwap = card('hSD07-007');
  const flareBuzz = card('hSD07-008');
  const flareGuard = card('hSD07-009');
  const noel = card('hSD07-010');
  const elfriend = card('hSD07-015');
  const target = { ...dummy, number: 'AUDIT-HSD07-006-010-TARGET', hp: 10000, arts: [{ name: 'No attack', damage: 0, cost: [], effect: '' }] };
  const hitter = { ...dummy, number: 'AUDIT-HSD07-006-010-HITTER', hp: 10000, arts: [{ name: 'Audit hit', damage: 250, cost: [], effect: '' }] };
  const guardHitter = { ...hitter, number: 'AUDIT-HSD07-006-010-GUARD-HITTER', arts: [{ name: 'Audit hit', damage: 40, cost: [], effect: '' }] };
  const pool = [...cards, dummy, target, hitter, guardHitter];
  const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);

  test(`${runtime.name}: hSD07-006 Bloom searches exactly one Elfriend and adds it to hand`, () => {
    assert.match(flareSearch.keyword.effect, /公開1張〈エルフレンド〉.*加入手牌.*洗牌/u);
    const debut = cards.find(candidate => candidate.jpName === flareSearch.jpName && candidate.stage === 'Debut');
    const other = cards.find(candidate => candidate.number !== elfriend.number && candidate.group === 'holomem');
    assert.ok(debut && elfriend && other);
    let battle = state(debut.number, target.number);
    battle.phase = 'main';
    battle.players[0].hand = [inst(flareSearch.number, 'bloom-hsd07-006')];
    battle.players[0].mainDeck = [inst(other.number, 'not-elfriend'), inst(elfriend.number, 'elfriend-search'), inst(other.number, 'tail')];
    battle = applyAction(battle, 0, { type: 'play', cardId: 'bloom-hsd07-006' }, pool, () => 0);
    assert.ok(battle.pendingChoice, 'Bloom should ask which legal stage receives the 1st Holomen');
    battle = choose(battle, { zone: 'center' });
    assert.equal(battle.pendingChoice?.effect, 'deckToHandShuffle');
    assert.equal(battle.pendingChoice.optional, false);
    assert.deepEqual(battle.pendingChoice.cards.map(instance => instance.id), ['elfriend-search']);
    battle = choose(battle, { cardIds: ['elfriend-search'] });
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'elfriend-search'));
    assert.ok(!battle.players[0].mainDeck.some(instance => instance.id === 'elfriend-search'));
    assert.equal(battle.players[0].mainDeck.length, 2);
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['tail', 'not-elfriend'], 'the remaining deck is shuffled after the search');
  });

  test(`${runtime.name}: hSD07-006 Arts +30 applies only at three or fewer Life`, () => {
    assert.deepEqual([flareSearch.arts[0].damage, flareSearch.arts[0].cost], [30, ['無色']]);
    assert.match(flareSearch.arts[0].effect, /生命值在3以下.*\+30/u);
    const damageAt = lifeCount => {
      let battle = state(flareSearch.number, target.number);
      battle.phase = 'performance';
      battle.players[0].life = Array.from({ length: lifeCount }, (_, i) => inst('hY01-001', `life-${i}`));
      battle.players[0].zones.center = unit(flareSearch.number);
      fund(battle.players[0].zones.center, flareSearch.arts[0].cost);
      battle.players[1].zones.center = unit(target.number);
      battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
      return battle.players[1].zones.center.damage;
    };
    assert.equal(damageAt(4), 30, 'four Life is outside the threshold');
    assert.equal(damageAt(3), 60, 'three Life grants the printed +30');
  });

  test(`${runtime.name}: hSD07-007 backline Bloom swaps only when Collab has 70 or fewer HP remaining`, () => {
    assert.match(flareSwap.keyword.effect, /僅限後排.*剩餘HP70以下.*互換/u);
    const debut = cards.find(candidate => candidate.jpName === flareSwap.jpName && candidate.stage === 'Debut');
    assert.ok(debut);
    const bloomIntoBackline = remainingHp => {
      let battle = state(target.number, target.number);
      battle.phase = 'main';
      battle.players[0].zones.center = unit(target.number);
      battle.players[0].zones.back1 = unit(debut.number, { stack: [inst(debut.number, 'flare-debut-back')] });
      battle.players[0].zones.collab = unit(debut.number, { stack: [inst(debut.number, 'collab-target')], damage: debut.hp - remainingHp });
      battle.players[0].hand = [inst(flareSwap.number, 'flare-1st')];
      battle = applyAction(battle, 0, { type: 'play', cardId: 'flare-1st' }, pool, () => 0);
      assert.ok(battle.pendingChoice, 'Bloom should offer the compatible backline Debut');
      battle = choose(battle, { zone: 'back1' });
      return battle;
    };
    let at70 = bloomIntoBackline(70);
    assert.equal(at70.pendingChoice?.effect, 'swapCollab');
    assert.equal(at70.pendingChoice.optional, true);
    assert.deepEqual(at70.pendingChoice.options, ['back1']);
    at70 = choose(at70, { zone: 'back1' });
    assert.equal(at70.players[0].zones.collab.stack.at(-1).number, flareSwap.number);
    assert.equal(at70.players[0].zones.back1.stack.at(-1).id, 'collab-target');

    const at71 = bloomIntoBackline(71);
    assert.notEqual(at71.pendingChoice?.effect, 'swapCollab');
    assert.equal(at71.players[0].zones.collab.stack.at(-1).id, 'collab-target');
  });

  test(`${runtime.name}: hSD07-007 Bloom in Center does not offer its backline-only swap`, () => {
    const debut = cards.find(candidate => candidate.jpName === flareSwap.jpName && candidate.stage === 'Debut');
    let battle = state(debut.number, target.number);
    battle.phase = 'main';
    battle.players[0].zones.center = unit(debut.number);
    battle.players[0].zones.collab = unit(debut.number, { stack: [inst(debut.number, 'collab-target')], damage: debut.hp - 70 });
    battle.players[0].hand = [inst(flareSwap.number, 'flare-1st')];
    battle = applyAction(battle, 0, { type: 'play', cardId: 'flare-1st' }, pool, () => 0);
    assert.ok(battle.pendingChoice?.options.includes('center'));
    battle = choose(battle, { zone: 'center' });
    assert.notEqual(battle.pendingChoice?.effect, 'swapCollab');
    assert.equal(battle.players[0].zones.collab.stack.at(-1).id, 'collab-target');
  });

  test(`${runtime.name}: hSD07-007 and hSD07-010 resolve their printed basic Arts values and costs`, () => {
    assert.deepEqual([flareSwap.arts[0].damage, flareSwap.arts[0].cost], [40, ['黃', '無色']]);
    assert.deepEqual([noel.arts[0].damage, noel.arts[0].cost], [20, ['無色']]);
    for (const [source, expected] of [[flareSwap, 40], [noel, 20]]) {
      let battle = state(source.number, target.number);
      battle.phase = 'performance';
      battle.players[0].zones.center = unit(source.number);
      fund(battle.players[0].zones.center, source.arts[0].cost);
      battle.players[1].zones.center = unit(target.number);
      battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
      assert.equal(battle.players[1].zones.center.damage, expected);
    }
  });

  test(`${runtime.name}: hSD07-008 Arts can attach an archived Elfriend only to this Flare`, () => {
    assert.match(flareBuzz.arts[0].effect, /檔案區域.*1張〈エルフレンド〉附加到此Holomen/u);
    assert.equal(elfriend.typeCode, 'supportFan');
    let battle = state(flareBuzz.number, target.number);
    battle.phase = 'performance';
    battle.players[0].zones.center = unit(flareBuzz.number);
    fund(battle.players[0].zones.center, flareBuzz.arts[0].cost);
    battle.players[0].archive = [inst(elfriend.number, 'archive-elfriend')];
    battle.players[1].zones.center = unit(target.number);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'genericArchiveSupportPick');
    assert.equal(battle.pendingChoice.optional, true);
    assert.deepEqual(battle.pendingChoice.cards.map(instance => instance.id), ['archive-elfriend']);
    battle = choose(battle, { cardIds: ['archive-elfriend'] });
    assert.deepEqual(battle.pendingChoice?.options, ['center']);
    battle = choose(battle, { zone: 'center' });
    assert.ok(battle.players[0].zones.center.attachments.some(instance => instance.id === 'archive-elfriend'));
    assert.equal(battle.players[1].zones.center.damage, 50, 'the attack resolves its printed base Arts damage after resolving the optional attachment');
  });

  test(`${runtime.name}: hSD07-008 Buzz knockout reduces its owner's Life by two`, () => {
    assert.match(flareBuzz.extra, /被打倒時.*生命-2/u);
    let battle = state(hitter.number, flareBuzz.number);
    battle.phase = 'performance';
    battle.players[0].zones.center = unit(hitter.number);
    battle.players[1].zones.center = unit(flareBuzz.number);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center, null, '250 damage defeats the 250 HP Buzz');
    assert.equal(battle.players[1].life.length, 3);
  });

  test(`${runtime.name}: hSD07-009 Arts +70 applies only at three or fewer Life`, () => {
    assert.deepEqual([flareGuard.arts[0].damage, flareGuard.arts[0].cost], [70, ['黃', '無色', '無色']]);
    assert.match(flareGuard.arts[0].effect, /生命值在3以下.*\+70/u);
    const damageAt = lifeCount => {
      let battle = state(flareGuard.number, target.number);
      battle.phase = 'performance';
      battle.players[0].life = Array.from({ length: lifeCount }, (_, i) => inst('hY01-001', `guard-life-${i}`));
      battle.players[0].zones.center = unit(flareGuard.number);
      fund(battle.players[0].zones.center, flareGuard.arts[0].cost);
      battle.players[1].zones.center = unit(target.number);
      battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
      return battle.players[1].zones.center.damage;
    };
    assert.equal(damageAt(4), 70);
    assert.equal(damageAt(3), 140);
  });

  test(`${runtime.name}: hSD07-009 Gift reduces Arts damage by 10 only in Center`, () => {
    assert.match(flareGuard.keyword.effect, /僅限中央位置.*受到的傷害-10/u);
    const damageAt = zone => {
      let battle = state(hitter.number, target.number);
      battle.phase = 'performance';
      battle.players[0].zones.center = unit(guardHitter.number);
      battle.players[1].zones[zone] = unit(flareGuard.number);
      battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: zone, artIndex: 0 }, pool, () => 0);
      return battle.players[1].zones[zone].damage;
    };
    assert.equal(damageAt('center'), 30);
    assert.equal(damageAt('collab'), 40);
  });

  test(`${runtime.name}: hSD07-010 Collab gives own Center Arts +10 for the turn`, () => {
    assert.match(noel.keyword.effect, /這回合.*我方中心Holomen的Arts\+10/u);
    let battle = state('hSD07-006', target.number);
    battle.phase = 'main';
    battle.players[0].zones.center = unit('hSD07-006');
    battle.players[0].zones.back2 = unit('hSD07-005');
    battle.players[0].zones.back1 = unit(noel.number);
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.players[0].zones.collab.stack.at(-1).number, noel.number);
    assert.equal((battle.players[0].zones.back2.modifiers || []).some(modifier => modifier.kind === 'arts'), false, 'the Collab buff is restricted to the Center');
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, flareSearch.arts[0].cost);
    battle.players[1].zones.center = unit(target.number);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 40, 'Flare base 30 Arts receives Noel Collab +10');
  });
}
