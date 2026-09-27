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
  const controlAttacker = { ...dummy, number: 'AUDIT-TWENTY-ATTACKER', hp: 1000, arts: [{ name: 'Audit 20', damage: 20, cost: [], effect: '' }] };
  const cookingCards = [...cards, dummy, controlAttacker];
  const card = number => cards.find(candidate => candidate.number === number);
  const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, cookingCards, () => 0);
  const play = (battle, id) => applyAction(battle, 0, { type: 'play', cardId: id }, cookingCards, () => 0);

  test(`${runtime.name}: hSD05-006 counts different #ReGLOSS names across stage only; its basic Arts remains 30`, () => {
    const bancho = card('hSD05-006');
    const otherNames = [...new Map(cards.filter(candidate => candidate.group === 'holomem'
      && candidate.number !== bancho.number && candidate.jpName !== bancho.jpName
      && candidate.tags.includes('#ReGLOSS') && ['Debut', 'Spot', '1st', '2nd'].includes(candidate.stage))
      .map(candidate => [candidate.jpName || candidate.name, candidate])).values()];
    assert.ok(otherNames.length >= 2, 'catalog needs at least two distinct other #ReGLOSS names');
    assert.deepEqual(bancho.arts.map(art => [art.damage, art.cost]), [[30, ['無色']], [50, ['白', '無色']]]);
    assert.match(bancho.arts[1].effect, /3位以上.*不同卡名.*#ReGLOSS.*\+20/u);

    let threeNames = main(bancho.number);
    threeNames.players[0].zones.back1 = unit(otherNames[0].number);
    threeNames.players[0].zones.back2 = unit(otherNames[1].number);
    threeNames.phase = 'performance';
    fund(threeNames.players[0].zones.center, bancho.arts[1].cost);
    threeNames = applyAction(threeNames, 0, { ...attack, artIndex: 1 }, cookingCards, () => 0);
    assert.equal(threeNames.players[1].zones.center.damage, 70, 'Bancho plus two distinct #ReGLOSS names reaches three and adds 20');

    let repeatedName = main(bancho.number);
    repeatedName.players[0].zones.back1 = unit(card('hSD05-002').number);
    repeatedName.players[0].zones.back2 = unit(card('hSD05-003').number);
    repeatedName.phase = 'performance';
    fund(repeatedName.players[0].zones.center, bancho.arts[1].cost);
    repeatedName = applyAction(repeatedName, 0, { ...attack, artIndex: 1 }, cookingCards, () => 0);
    assert.equal(repeatedName.players[1].zones.center.damage, 50, 'multiple Bancho cards still count as one card name');
  });

  test(`${runtime.name}: hSD05-007 draws one card when it Blooms`, () => {
    const debut = card('hSD05-002');
    const first = card('hSD05-007');
    assert.equal(first.keyword.type, 'bloom_effect');
    assert.match(first.keyword.effect, /抽1張牌/u);
    let battle = main(debut.number);
    battle.players[0].hand = [inst(first.number, 'first-bloom')];
    battle.players[0].mainDeck = [inst('AUDIT-DUMMY', 'bloom-draw'), inst('AUDIT-DUMMY', 'deck-tail')];
    battle = play(battle, 'first-bloom');
    assert.ok(battle.pendingChoice?.options.includes('center'));
    battle = choose(battle, { zone: 'center' });
    assert.deepEqual(battle.players[0].hand.map(instance => instance.id), ['bloom-draw']);
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['deck-tail']);
  });

  test(`${runtime.name}: hSD05-008 Buzz loses two Life on knockout; its Arts buffs a chosen #ReGLOSS Debut by 40 this turn`, () => {
    const buzz = card('hSD05-008');
    const debut = card('hSD05-002');
    assert.match(buzz.extra, /被擊倒時.*生命-2/u);
    assert.match(buzz.arts[0].effect, /#ReGLOSS.*Debut.*Arts\+40/u);

    let battle = main(buzz.number);
    battle.phase = 'performance';
    battle.players[0].zones.collab = unit(debut.number);
    fund(battle.players[0].zones.center, buzz.arts[0].cost);
    battle = applyAction(battle, 0, attack, cookingCards, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'artBuffTarget');
    assert.deepEqual(battle.pendingChoice.options, ['collab']);
    battle = choose(battle, { zone: 'collab' });
    assert.equal(battle.players[1].zones.center.damage, 50);
    assert.ok(battle.players[0].zones.collab.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 40 && modifier.expiresTurn === battle.turn));

    fund(battle.players[0].zones.collab, debut.arts[0].cost);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 }, cookingCards, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 120, 'the buff is usable by the selected Holomen this turn');

    let knockout = main(controlAttacker.number, buzz.number);
    knockout.phase = 'performance';
    knockout.activePlayer = 1;
    knockout.players[0].zones.center = unit(buzz.number, { damage: Number(buzz.hp) - 20 });
    knockout.players[1].zones.center = unit(controlAttacker.number);
    knockout = applyAction(knockout, 1, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, cookingCards, () => 0);
    assert.equal(knockout.players[0].zones.center, null);
    assert.equal(knockout.players[0].life.length, 3, 'the printed Buzz knockout text reduces Life by two');
  });

  test(`${runtime.name}: hSD05-009 Bloom searches only #ReGLOSS Debut/1st and shuffles after adding one`, () => {
    const first = card('hSD05-005');
    const second = card('hSD05-009');
    const legal = card('hSD05-002');
    const wrongTag = cards.find(candidate => candidate.group === 'holomem' && candidate.stage === 'Debut' && !candidate.tags.includes('#ReGLOSS'));
    const wrongStage = cards.find(candidate => candidate.group === 'holomem' && candidate.stage === '2nd' && candidate.tags.includes('#ReGLOSS'));
    assert.ok(wrongTag && wrongStage);
    assert.match(second.keyword.effect, /#ReGLOSS.*Debut Holomen或1st Holomen.*加入手牌.*洗牌/u);

    let battle = main(first.number);
    battle.players[0].hand = [inst(second.number, 'second-bloom')];
    battle.players[0].mainDeck = [inst(wrongTag.number, 'wrong-tag'), inst(wrongStage.number, 'wrong-stage'), inst(legal.number, 'legal-regloss'), inst('AUDIT-DUMMY', 'deck-tail')];
    battle = play(battle, 'second-bloom');
    battle = choose(battle, { zone: 'center' });
    assert.equal(battle.pendingChoice?.effect, 'deckToHandShuffle');
    assert.deepEqual(battle.pendingChoice.selectableIds, ['legal-regloss']);
    battle = choose(battle, { cardIds: ['legal-regloss'] });
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'legal-regloss'));
    assert.deepEqual(new Set(battle.players[0].mainDeck.map(instance => instance.id)), new Set(['wrong-tag', 'wrong-stage', 'deck-tail']));
  });

  test(`${runtime.name}: hSD05-009 Arts adds 30 only for another #ReGLOSS name and its Purple target bonus`, () => {
    const second = card('hSD05-009');
    const raden = card('hSD05-010');
    const purple = cards.find(candidate => candidate.group === 'holomem' && candidate.colors.includes('紫') && Number(candidate.hp) >= 220 && candidate.number !== second.number);
    assert.ok(raden && purple);
    assert.deepEqual([second.arts[0].damage, second.arts[0].cost, second.arts[0].specialTargets, second.arts[0].specialValues], [80, ['白', '白', '無色'], ['紫'], [50]]);

    let boosted = main(second.number, purple.number);
    boosted.players[0].zones.back1 = unit(raden.number);
    boosted.phase = 'performance';
    fund(boosted.players[0].zones.center, second.arts[0].cost);
    boosted = applyAction(boosted, 0, attack, cookingCards, () => 0);
    assert.equal(boosted.players[1].zones.center.damage, 160, '80 base + 30 for another #ReGLOSS + 50 against Purple');

    let onlyBancho = main(second.number, purple.number);
    onlyBancho.phase = 'performance';
    fund(onlyBancho.players[0].zones.center, second.arts[0].cost);
    onlyBancho = applyAction(onlyBancho, 0, attack, cookingCards, () => 0);
    assert.equal(onlyBancho.players[1].zones.center.damage, 130, 'Bancho itself does not satisfy its additional-name condition');
  });

  test(`${runtime.name}: hSD05-010 Arts optionally moves only an archived Cheer to an own #ReGLOSS Holomen`, () => {
    const raden = card('hSD05-010');
    const regloss = card('hSD05-004');
    const nonRegloss = card('hSD04-005');
    const cheer = cards.find(candidate => candidate.group === 'cheer');
    assert.ok(raden && regloss && nonRegloss && cheer);
    assert.match(raden.arts[0].effect, /可以.*檔案區域.*1張應援.*#ReGLOSS/u);

    let battle = main(raden.number);
    battle.players[0].zones.back1 = unit(regloss.number);
    battle.players[0].zones.back2 = unit(nonRegloss.number);
    battle.players[0].archive = [inst(cheer.number, 'archived-cheer')];
    battle.phase = 'performance';
    fund(battle.players[0].zones.center, raden.arts[0].cost);
    battle = applyAction(battle, 0, attack, cookingCards, () => 0);
    assert.ok(battle.pendingChoice, 'the optional Cheer movement is offered after Arts');
    battle = choose(battle, { cardIds: ['archived-cheer'] });
    assert.ok(battle.pendingChoice?.options.includes('back1'));
    assert.ok(!battle.pendingChoice?.options.includes('back2'), 'the recipient must have #ReGLOSS');
    battle = choose(battle, { zone: 'back1' });
    assert.equal(battle.players[0].zones.back1.cheer[0]?.id, 'archived-cheer');
    assert.equal(battle.players[0].archive.some(instance => instance.id === 'archived-cheer'), false);
    assert.equal(battle.players[1].zones.center.damage, 20);

    let skipped = main(raden.number);
    skipped.players[0].archive = [inst(cheer.number, 'skip-cheer')];
    skipped.phase = 'performance';
    fund(skipped.players[0].zones.center, raden.arts[0].cost);
    skipped = applyAction(skipped, 0, attack, cookingCards, () => 0);
    skipped = choose(skipped, { skip: true });
    assert.equal(skipped.players[1].zones.center.damage, 20);
    assert.equal(skipped.players[0].archive[0]?.id, 'skip-cheer', 'the optional effect may be declined');
  });
}
