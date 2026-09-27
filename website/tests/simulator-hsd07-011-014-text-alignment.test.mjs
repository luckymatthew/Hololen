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
  const miko = card('hSD07-011');
  const polka = card('hSD07-012');
  const suisei = card('hSD07-013');
  const event = card('hSD07-014');
  const target = { ...dummy, number: 'AUDIT-HSD07-011-014-TARGET', name: 'Audit target', jpName: 'Audit target', hp: 10000, arts: [{ name: 'No attack', damage: 0, cost: [], effect: '' }] };
  const pool = [...cards, dummy, target];
  const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);
  const main = source => { const battle = state(source, target.number); battle.phase = 'main'; return battle; };

  test(`${runtime.name}: hSD07-011/012/013 basic Arts are each 20 for one Colorless Cheer`, () => {
    for (const source of [miko, polka, suisei]) {
      assert.deepEqual([source.arts[0].damage, source.arts[0].cost], [20, ['無色']], source.number);
      let battle = state(source.number, target.number);
      battle.phase = 'performance';
      battle.players[0].zones.center = unit(source.number);
      fund(battle.players[0].zones.center, source.arts[0].cost);
      battle.players[1].zones.center = unit(target.number);
      battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
      assert.equal(battle.players[1].zones.center.damage, 20, source.number);
    }
  });

  test(`${runtime.name}: hSD07-011 Collab deals 10 special damage to opponent Center while target survives`, () => {
    assert.match(miko.keyword.effect, /對對手的中央Holomen造成10點特殊傷害/u);
    let battle = main(target.number);
    battle.players[0].zones.back1 = unit(miko.number);
    battle.players[1].zones.center = unit(target.number);
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 10);
    assert.equal(battle.players[1].life.length, 5, 'the 10 special damage does not defeat this target');
  });

  test(`${runtime.name}: hSD07-012 draws only with a Flare Center and strictly smaller hand`, () => {
    assert.match(polka.keyword.effect, /中心Holomen是〈不知火フレア〉.*手牌數比對手少.*抽1張牌/u);
    const collab = (centerNumber, ownHandCount, opposingHandCount) => {
      let battle = main(centerNumber);
      battle.players[0].zones.center = unit(centerNumber);
      battle.players[0].zones.back1 = unit(polka.number);
      battle.players[0].hand = Array.from({ length: ownHandCount }, (_, index) => inst(dummy.number, `own-${index}`));
      battle.players[1].hand = Array.from({ length: opposingHandCount }, (_, index) => inst(dummy.number, `opponent-${index}`));
      battle.players[0].mainDeck = [inst(dummy.number, 'collab-power'), inst(dummy.number, 'draw'), inst(dummy.number, 'tail')];
      return applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    };
    const enabled = collab('hSD07-004', 1, 2);
    assert.ok(enabled.players[0].hand.some(instance => instance.id === 'draw'));
    assert.equal(enabled.players[0].mainDeck.some(instance => instance.id === 'tail'), true);
    const equalHand = collab('hSD07-004', 2, 2);
    assert.ok(!equalHand.players[0].hand.some(instance => instance.id.startsWith('draw')));
    const wrongCenter = collab(target.number, 1, 2);
    assert.ok(!wrongCenter.players[0].hand.some(instance => instance.id.startsWith('draw')));
  });

  test(`${runtime.name}: hSD07-013 Collab optionally moves one archived Cheer to a Holomen other than Center`, () => {
    assert.match(suisei.keyword.effect, /中心Holomen是〈不知火フレア〉.*檔案區域中的1張應援卡.*除了該Holomen以外/u);
    let battle = main('hSD07-004');
    battle.players[0].zones.center = unit('hSD07-004');
    battle.players[0].zones.back1 = unit(target.number);
    battle.players[0].zones.back2 = unit(suisei.number);
    battle.players[0].archive = [inst('hY01-001', 'archive-cheer')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back2' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'archiveCheerToStage');
    assert.equal(battle.pendingChoice.optional, true);
    assert.deepEqual(battle.pendingChoice.cards.map(instance => instance.id), ['archive-cheer']);
    battle = choose(battle, { cardIds: ['archive-cheer'] });
    assert.ok(!battle.pendingChoice.options.includes('center'));
    assert.ok(battle.pendingChoice.options.includes('back1'));
    battle = choose(battle, { zone: 'back1' });
    assert.ok(battle.players[0].zones.back1.cheer.some(instance => instance.id === 'archive-cheer'));
    assert.equal(battle.players[0].archive.some(instance => instance.id === 'archive-cheer'), false);

    let blocked = main(target.number);
    blocked.players[0].zones.center = unit(target.number);
    blocked.players[0].zones.back1 = unit(suisei.number);
    blocked.players[0].archive = [inst('hY01-001', 'blocked-cheer')];
    blocked = applyAction(blocked, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(blocked.pendingChoice, null, 'the center condition gates the optional transfer');
    assert.ok(blocked.players[0].archive.some(instance => instance.id === 'blocked-cheer'));
  });

  test(`${runtime.name}: hSD07-014 searches exactly four cards, permits any named matches, bottoms the rest, and enforces hand/LIMITED limits`, () => {
    const flares = cards.filter(candidate => candidate.group === 'holomem' && candidate.jpName.includes('不知火フレア'));
    const mikoCard = card('hSD07-011');
    const suiseiCard = card('hSD07-013');
    const noel = card('hSD07-010');
    assert.match(event.abilityText, /手牌（不含這張卡）為6張以下/u);
    assert.match(event.abilityText, /查看自己牌庫上方4張.*任意數量/u);
    assert.equal(event.typeCode, 'supportEventLimited');
    assert.ok(flares.length > 0 && mikoCard && suiseiCard && noel);

    let battle = main(target.number);
    battle.players[0].hand = [inst(event.number, 'event-exact-limit'), ...Array.from({ length: 6 }, (_, index) => inst(dummy.number, `hand-${index}`))];
    battle.players[0].mainDeck = [inst(flares[0].number, 'flare-top'), inst(mikoCard.number, 'miko-top'), inst(polka.number, 'polka-top'), inst(suiseiCard.number, 'suisei-top'), inst(noel.number, 'tail-noel')];
    battle = applyAction(battle, 0, { type: 'play', cardId: 'event-exact-limit' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'topLookToHand');
    assert.equal(battle.pendingChoice.optional, true);
    assert.equal(battle.pendingChoice.cards.length, 4, 'only the top four cards are revealed');
    assert.deepEqual(new Set(battle.pendingChoice.selectableIds), new Set(['flare-top', 'miko-top', 'polka-top', 'suisei-top']));
    battle = choose(battle, { cardIds: ['flare-top', 'polka-top'] });
    assert.deepEqual(battle.players[0].hand.slice(-2).map(instance => instance.id), ['flare-top', 'polka-top']);
    assert.equal(battle.pendingChoice?.effect, 'bottomOrder');
    assert.deepEqual(new Set(battle.pendingChoice.cards.map(instance => instance.id)), new Set(['miko-top', 'suisei-top']));
    battle = choose(battle, { cardIds: ['suisei-top', 'miko-top'] });
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['tail-noel', 'suisei-top', 'miko-top']);
    assert.equal(battle.players[0].limitedUsesCount, 1);

    let noelCase = main(target.number);
    noelCase.players[0].hand = [inst(event.number, 'event-noel'), ...Array.from({ length: 6 }, (_, index) => inst(dummy.number, `noel-hand-${index}`))];
    noelCase.players[0].mainDeck = [inst(target.number, 'nonmatch-a'), inst(noel.number, 'noel-top'), inst(target.number, 'nonmatch-b'), inst(target.number, 'nonmatch-c')];
    noelCase = applyAction(noelCase, 0, { type: 'play', cardId: 'event-noel' }, pool, () => 0);
    assert.deepEqual(noelCase.pendingChoice.selectableIds, ['noel-top']);
    noelCase = choose(noelCase, { cardIds: ['noel-top'] });
    assert.equal(noelCase.players[0].hand.at(-1).id, 'noel-top');
    noelCase = choose(noelCase, { cardIds: ['nonmatch-c', 'nonmatch-b', 'nonmatch-a'] });
    assert.deepEqual(noelCase.players[0].mainDeck.map(instance => instance.id), ['nonmatch-c', 'nonmatch-b', 'nonmatch-a']);

    let overLimit = main(target.number);
    overLimit.players[0].hand = [inst(event.number, 'event-too-many'), ...Array.from({ length: 7 }, (_, index) => inst(dummy.number, `over-${index}`))];
    overLimit.players[0].mainDeck = [inst(target.number, 'nonmatch-1'), inst(target.number, 'nonmatch-2'), inst(target.number, 'nonmatch-3'), inst(target.number, 'nonmatch-4')];
    assert.throws(() => applyAction(overLimit, 0, { type: 'play', cardId: 'event-too-many' }, pool, () => 0), /除這張卡外的手牌不可多於 6 張/u);

    let secondUse = main(target.number);
    secondUse.players[0].hand = [inst(event.number, 'event-first'), inst(event.number, 'event-second')];
    secondUse.players[0].mainDeck = Array.from({ length: 4 }, (_, index) => inst(target.number, `nonmatch-${index}`));
    secondUse = applyAction(secondUse, 0, { type: 'play', cardId: 'event-first' }, pool, () => 0);
    assert.equal(secondUse.pendingChoice?.effect, 'bottomOrder');
    secondUse = choose(secondUse, { cardIds: secondUse.pendingChoice.cards.map(instance => instance.id) });
    assert.throws(() => applyAction(secondUse, 0, { type: 'play', cardId: 'event-second' }, pool, () => 0), /最多只可使用 1 張 LIMITED 支援卡/u);
  });
}
