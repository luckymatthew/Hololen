import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction, validateBattleDeck as websiteValidateBattleDeck } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, fund, inst, state, unit } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, validateBattleDeck: websiteValidateBattleDeck, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const cards = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, validateBattleDeck: engine.validateBattleDeck, cards });
}

for (const runtime of runtimes) {
  const { cards, applyAction, validateBattleDeck } = runtime;
  const card = number => cards.find(candidate => candidate.number === number);
  const flareOshi = card('hSD07-001');
  const flareUnlimited = card('hSD07-002');
  const flareCollab = card('hSD07-003');
  const flareHandArts = card('hSD07-004');
  const flareFirst = card('hSD07-005');
  const target = { ...dummy, number: 'AUDIT-HSD07-TARGET', hp: 10000, arts: [{ name: 'No attack', damage: 0, cost: [], effect: '' }] };
  const pool = [...cards, dummy, target];
  const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);

  test(`${runtime.name}: hSD07-001 normal Oshi skill pays 2, buffs only the yellow Center +20, and is once per turn`, () => {
    assert.match(flareOshi.oshiSkill.effect, /黃屬性中心Holomen的Arts\+20/u);
    let battle = state(flareUnlimited.number, target.number);
    battle.phase = 'main';
    battle.players[0].oshi = inst(flareOshi.number);
    battle.players[0].holoPower = [inst(dummy.number, 'power-1'), inst(dummy.number, 'power-2')];
    battle.players[0].zones.center = unit(flareUnlimited.number);
    battle = applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0);
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.equal(battle.players[0].archive.filter(instance => instance.id.startsWith('power-')).length, 2);
    assert.equal(battle.players[0].oshiSkillTurn, battle.turn);
    fund(battle.players[0].zones.center, flareUnlimited.arts[0].cost);
    battle.phase = 'performance';
    battle.players[1].zones.center = unit(target.number);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, flareUnlimited.arts[0].damage + 20);
    battle.phase = 'main';
    assert.throws(() => applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0), /本回合已使用過推し技能/u);
  });

  test(`${runtime.name}: hSD07-001 SP skill pays 1, swaps with a ready backline Holomen, heals the moved Center by 30, and is once per game`, () => {
    assert.match(flareOshi.spOshiSkill.effect, /中心Holomen與一位未休息的後排Holomen互換位置.*移動到後排位置的Holomen回復30點HP/u);
    let battle = state(flareHandArts.number, target.number);
    battle.phase = 'main';
    battle.players[0].oshi = inst(flareOshi.number);
    battle.players[0].holoPower = [inst(dummy.number, 'sp-power')];
    battle.players[0].zones.center = unit(flareHandArts.number, { damage: 20 });
    battle.players[0].zones.back1 = unit(flareFirst.number, { damage: 40 });
    battle.players[0].zones.back2 = unit('hSD07-006', { damage: 50, rested: true });
    battle = applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0);
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.equal(battle.players[0].archive.some(instance => instance.id === 'sp-power'), true);
    assert.equal(battle.pendingChoice?.effect, 'oshiStarterOwnSwap');
    assert.deepEqual(battle.pendingChoice.options, ['back1'], 'a rested backline member is not a legal swap target');
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.players[0].zones.center.stack.at(-1).number, flareFirst.number);
    assert.equal(battle.players[0].zones.center.damage, 40, 'the former backline remains at its existing damage');
    assert.equal(battle.players[0].zones.back1.stack.at(-1).number, flareHandArts.number);
    assert.equal(battle.players[0].zones.back1.damage, 0, 'the former Center moves back and heals 20 of its 30-point damage');
    assert.equal(battle.players[0].spOshiSkillUsed, true);
    assert.throws(() => applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0), /SP 推し技能/u);
  });

  test(`${runtime.name}: hSD07-002 is unlimited in deck construction and both Arts resolve at printed damage and cost`, () => {
    assert.match(flareUnlimited.extra, /任意張數/u);
    assert.ok(flareUnlimited.maxCopies > 4);
    const main = { [flareUnlimited.number]: 6 };
    let count = 6;
    const used = new Set([flareUnlimited.number]);
    for (const candidate of cards) {
      if (count >= 50) break;
      if (candidate.group !== 'holomem' || used.has(candidate.number)) continue;
      const copies = Math.min(Number(candidate.maxCopies || 4), 4, 50 - count);
      if (copies <= 0) continue;
      main[candidate.number] = copies;
      used.add(candidate.number);
      count += copies;
    }
    assert.equal(count, 50);
    assert.equal(validateBattleDeck({ oshi: { [flareOshi.number]: 1 }, main, cheer: { 'hY01-001': 20 } }, cards).ok, true);

    assert.deepEqual(flareUnlimited.arts.map(art => [art.damage, art.cost]), [[20, ['無色']], [60, ['無色', '無色', '無色']]]);
    for (const [artIndex, damage] of [[0, 20], [1, 60]]) {
      let battle = state(flareUnlimited.number, target.number);
      battle.phase = 'performance';
      battle.players[0].zones.center = unit(flareUnlimited.number);
      fund(battle.players[0].zones.center, flareUnlimited.arts[artIndex].cost);
      battle.players[1].zones.center = unit(target.number);
      battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex }, pool, () => 0);
      assert.equal(battle.players[1].zones.center.damage, damage);
    }
  });

  test(`${runtime.name}: hSD07-003 Collab finds one of the four named Debut Holomen at five or fewer stage Holomen and then shuffles`, () => {
    const allowed = ['尾丸ポルカ', 'さくらみこ', '星街すいせい', '白銀ノエル'];
    assert.match(flareCollab.keyword.effect, /舞台上有5位或以下.*公開1張Debut Holomen.*尾丸ポルカ.*さくらみこ.*星街すいせい.*白銀ノエル.*放到舞台上.*洗牌/u);
    const candidate = card('hSD07-012');
    assert.ok(allowed.some(name => candidate.jpName.includes(name)));
    let battle = state('hSD07-004', target.number);
    battle.phase = 'main';
    battle.players[0].zones.center = unit('hSD07-004');
    battle.players[0].zones.back1 = unit(flareCollab.number);
    battle.players[0].zones.back2 = unit('hSD07-005');
    battle.players[0].zones.back3 = unit('hSD07-006');
    battle.players[0].zones.back4 = unit('hSD07-002');
    battle.players[0].mainDeck = [inst(dummy.number, 'collab-cost'), inst(candidate.number, 'allowed-debut'), inst('hSD07-004', 'wrong-stage'), inst(dummy.number, 'tail')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'deckCardsToStage');
    assert.equal(battle.pendingChoice.optional, true, 'the text says the named debut may be deployed');
    assert.deepEqual(new Set(battle.pendingChoice.selectableIds), new Set(['allowed-debut']));
    battle = choose(battle, { cardIds: ['allowed-debut'] });
    assert.equal(battle.pendingChoice?.type, 'stageTarget');
    assert.ok(battle.pendingChoice.options.includes('back1'));
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.players[0].zones.back1.stack.at(-1).number, candidate.number);
    assert.deepEqual(new Set(battle.players[0].mainDeck.map(instance => instance.id)), new Set(['wrong-stage', 'tail']));
  });

  test(`${runtime.name}: hSD07-003 Collab condition does not run above five own stage Holomen`, () => {
    let battle = state(flareCollab.number, target.number);
    battle.phase = 'main';
    battle.players[0].zones.center = unit('hSD07-004');
    battle.players[0].zones.back1 = unit('hSD07-005');
    battle.players[0].zones.back2 = unit('hSD07-006');
    battle.players[0].zones.back3 = unit('hSD07-002');
    battle.players[0].zones.back4 = unit('hSD07-010');
    battle.players[0].zones.back5 = unit(flareCollab.number);
    battle.players[0].mainDeck = [inst(dummy.number, 'collab-cost'), inst('hSD07-012', 'allowed-debut'), inst(dummy.number, 'tail')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back5' }, pool, () => 0);
    assert.equal(battle.pendingChoice, null);
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['allowed-debut', 'tail']);
  });

  test(`${runtime.name}: hSD07-003 base Arts is 20 for one Yellow Cheer`, () => {
    assert.deepEqual([flareCollab.arts[0].damage, flareCollab.arts[0].cost], [20, ['黃']]);
    let battle = state(flareCollab.number, target.number);
    battle.phase = 'performance';
    battle.players[0].zones.center = unit(flareCollab.number);
    fund(battle.players[0].zones.center, flareCollab.arts[0].cost);
    battle.players[1].zones.center = unit(target.number);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 20);
  });

  test(`${runtime.name}: hSD07-004 Arts gets +10 only when own hand is smaller than the opponent's`, () => {
    const check = (ownHandCount, opposingHandCount) => {
      let battle = state(flareHandArts.number, target.number);
      battle.phase = 'performance';
      battle.players[0].zones.center = unit(flareHandArts.number);
      fund(battle.players[0].zones.center, flareHandArts.arts[0].cost);
      battle.players[0].hand = Array.from({ length: ownHandCount }, (_, i) => inst(dummy.number, `own-${i}`));
      battle.players[1].hand = Array.from({ length: opposingHandCount }, (_, i) => inst(dummy.number, `opponent-${i}`));
      battle.players[1].zones.center = unit(target.number);
      return applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0).players[1].zones.center.damage;
    };
    assert.match(flareHandArts.arts[0].effect, /手牌數比對手少.*Arts\+10/u);
    assert.deepEqual([flareHandArts.arts[0].damage, flareHandArts.arts[0].cost], [30, ['黃']]);
    assert.equal(check(1, 2), 40);
    assert.equal(check(2, 2), 30);
    assert.equal(check(3, 2), 30);
  });

  test(`${runtime.name}: hSD07-005's two Arts use the printed costs and damage`, () => {
    assert.deepEqual(flareFirst.arts.map(art => [art.damage, art.cost]), [[30, ['黃']], [50, ['黃', '無色']]]);
    for (const [artIndex, damage] of [[0, 30], [1, 50]]) {
      let battle = state(flareFirst.number, target.number);
      battle.phase = 'performance';
      battle.players[0].zones.center = unit(flareFirst.number);
      fund(battle.players[0].zones.center, flareFirst.arts[artIndex].cost);
      battle.players[1].zones.center = unit(target.number);
      battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex }, pool, () => 0);
      assert.equal(battle.players[1].zones.center.damage, damage);
    }
  });
}
