import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, state, unit, inst, fund } from './fixtures/simulator-audit.mjs';

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
const chooseAction = (battle, action, applyAction, pool) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);
const playAction = (battle, id, applyAction, pool) => applyAction(battle, 0, { type: 'play', cardId: id }, pool, () => 0);

for (const runtime of runtimes) {
  const { cards, applyAction } = runtime;
  const mascot = cards.find(candidate => candidate.number === 'hSD04-014');
  const cookingHolomen = {
    ...dummy,
    number: 'AUDIT-COOKING-HOLOMEM',
    name: 'Cooking-tag control',
    jpName: '料理タグ測試卡',
    tags: ['#料理'],
  };
  const twentyDamageHolomen = {
    ...dummy,
    number: 'AUDIT-TWENTY-ATTACKER',
    hp: 1000,
    arts: [{ name: 'Audit 20', damage: 20, cost: [], effect: '' }],
  };
  const pool = [...cards, dummy, cookingHolomen, twentyDamageHolomen];
  const card = number => cards.find(candidate => candidate.number === number);
  const choose = (battle, action) => chooseAction(battle, action, applyAction, pool);
  const play = (battle, id) => playAction(battle, id, applyAction, pool);

  test(`${runtime.name}: hSD04-011 Spot cannot Bloom; Choco-Center Collab trades one Holo Power for one hand card`, () => {
    const luna = card('hSD04-011');
    const debut = cards.find(candidate => candidate.group === 'holomem' && candidate.jpName === '癒月ちょこ' && candidate.stage === 'Debut');
    assert.ok(debut);
    assert.equal(luna.stage, 'Spot');
    assert.match(luna.extra, /不能進行Bloom/u);
    assert.deepEqual([luna.arts[0].damage, luna.arts[0].cost], [10, ['無色']]);

    let illegalBloom = main(debut.number);
    illegalBloom.players[0].hand = [inst(luna.number, 'luna-spot')];
    illegalBloom = play(illegalBloom, 'luna-spot');
    assert.ok(illegalBloom.pendingChoice?.options.includes('back1'));
    assert.ok(!illegalBloom.pendingChoice?.options.includes('center'));

    let battle = main();
    battle.players[0].zones.back1 = unit(luna.number);
    battle.players[0].holoPower = [inst('AUDIT-DUMMY', 'old-power')];
    battle.players[0].hand = [inst('AUDIT-DUMMY', 'hand-card')];
    battle.players[0].mainDeck = [inst('AUDIT-DUMMY', 'collab-power'), inst('AUDIT-DUMMY', 'deck-tail')];
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.players[0].holoPower.length, 2, 'Collab first puts the deck top into Holo Power');
    assert.equal(battle.pendingChoice?.effect, 'giftRaoraPowerPick');
    assert.deepEqual(new Set(battle.pendingChoice.selectableIds), new Set(['old-power', 'collab-power']));

    battle = choose(battle, { cardIds: ['old-power'] });
    assert.ok(battle.players[0].hand.some(instance => instance.id === 'old-power'));
    assert.equal(battle.pendingChoice?.effect, 'giftHandToPower');
    battle = choose(battle, { cardIds: ['hand-card'] });
    assert.deepEqual(new Set(battle.players[0].holoPower.map(instance => instance.id)), new Set(['collab-power', 'hand-card']));
    assert.deepEqual(battle.players[0].hand.map(instance => instance.id), ['old-power']);
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['deck-tail']);
  });

  test(`${runtime.name}: hSD04-012 enforces six other cards and once-per-turn LIMITed; top four accepts the three named Holomen`, () => {
    const event = card('hSD04-012');
    const namedHolomen = ['大空スバル', '癒月ちょこ', '姫森ルーナ'].map(name =>
      cards.find(candidate => candidate.group === 'holomem' && candidate.jpName === name));
    const decoy = cards.find(candidate => candidate.group === 'holomem' && !namedHolomen.some(target => target?.number === candidate.number));
    assert.ok(namedHolomen.every(Boolean) && decoy);
    assert.equal(event.typeCode, 'supportEventLimited');
    assert.match(event.abilityText, /手牌.*不含這張卡.*6張以下/u);
    assert.match(event.abilityText, /LIMITED.*每回合只能使用1張/u);

    let tooMany = main();
    tooMany.players[0].hand = [inst(event.number, 'too-many-event'), ...Array.from({ length: 7 }, (_, index) => inst('AUDIT-DUMMY', `too-many-${index}`))];
    assert.throws(() => play(tooMany, 'too-many-event'), /手牌不可多於 6 張/u);

    let battle = main();
    battle.players[0].hand = [inst(event.number, 'first-event'), inst(event.number, 'second-event'), ...Array.from({ length: 5 }, (_, index) => inst('AUDIT-DUMMY', `hand-${index}`))];
    battle.players[0].mainDeck = [
      inst(namedHolomen[0].number, 'subaru'),
      inst(namedHolomen[1].number, 'choco'),
      inst(namedHolomen[2].number, 'luna'),
      inst(decoy.number, 'bottom-card'),
      inst('AUDIT-DUMMY', 'deck-tail'),
    ];
    battle = play(battle, 'first-event');
    assert.equal(battle.pendingChoice?.effect, 'topLookToHand');
    assert.equal(battle.pendingChoice?.min, 0, 'revealing a qualifying Holomen is optional');
    assert.equal(battle.pendingChoice?.max, 3);
    assert.deepEqual(new Set(battle.pendingChoice.selectableIds), new Set(['subaru', 'choco', 'luna']));
    battle = choose(battle, { cardIds: ['subaru', 'luna'] });
    assert.deepEqual(battle.players[0].hand.filter(instance => ['subaru', 'luna'].includes(instance.id)).map(instance => instance.id), ['subaru', 'luna']);
    assert.equal(battle.pendingChoice?.effect, 'bottomOrder');
    assert.deepEqual(battle.pendingChoice.cards.map(instance => instance.id), ['choco', 'bottom-card']);
    battle = choose(battle, { cardIds: ['bottom-card', 'choco'] });
    assert.deepEqual(battle.players[0].mainDeck.map(instance => instance.id), ['deck-tail', 'bottom-card', 'choco']);
    assert.throws(() => play(battle, 'second-event'), /最多只可使用 1 張 LIMITED/u);

    let noMatch = main();
    noMatch.players[0].hand = [inst(event.number, 'no-match-event')];
    noMatch.players[0].mainDeck = Array.from({ length: 4 }, (_, index) => inst('AUDIT-DUMMY', `no-match-${index}`));
    noMatch = play(noMatch, 'no-match-event');
    assert.equal(noMatch.pendingChoice?.effect, 'bottomOrder', 'when none match, all four revealed cards still return to the deck bottom');
    noMatch = choose(noMatch, { cardIds: ['no-match-3', 'no-match-2', 'no-match-1', 'no-match-0'] });
    assert.deepEqual(noMatch.players[0].mainDeck.map(instance => instance.id), ['no-match-3', 'no-match-2', 'no-match-1', 'no-match-0']);
  });

  test(`${runtime.name}: hSD04-013 heals the selected Holomen; Cooking elsewhere grants only that target Arts +20 this turn`, () => {
    const event = card('hSD04-013');
    assert.equal(event.typeCode, 'supportEvent');
    assert.match(event.abilityText, /選擇我方的一位Holomen.*回復20點HP/u);
    assert.match(event.abilityText, /舞台上有持有#料理.*Arts再額外\+20/u);

    let battle = main();
    battle.players[0].zones.center.damage = 40;
    battle.players[0].zones.back1 = unit(cookingHolomen.number);
    battle.players[0].zones.back2 = unit('AUDIT-DUMMY', { damage: 30 });
    battle.players[0].hand = [inst(event.number, 'omelette')];
    battle = play(battle, 'omelette');
    assert.equal(battle.pendingChoice?.effect, 'chocoOmeletteTarget');
    battle = choose(battle, { zone: 'back2' });
    assert.equal(battle.players[0].zones.back2.damage, 10);
    assert.ok(battle.players[0].zones.back2.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 20 && modifier.expiresTurn === battle.turn));
    assert.equal(battle.players[0].zones.center.modifiers.length, 0, 'the bonus follows the selected Holomen, not an arbitrary or Food-tagged target');

    let noCooking = main();
    noCooking.players[0].zones.center.damage = 30;
    noCooking.players[0].hand = [inst(event.number, 'plain-omelette')];
    noCooking = play(noCooking, 'plain-omelette');
    noCooking = choose(noCooking, { zone: 'center' });
    assert.equal(noCooking.players[0].zones.center.damage, 10);
    assert.equal(noCooking.players[0].zones.center.modifiers.length, 0, 'healing still resolves without a Cooking-tagged Holomen, but the conditional bonus does not');
  });

  test(`${runtime.name}: hSD04-014 grants +20 HP, heals Choco on Bloom and permits only one mascot per own Holomen`, () => {
    const debutChoco = cards.find(candidate => candidate.group === 'holomem' && candidate.jpName === '癒月ちょこ' && candidate.stage === 'Debut');
    const firstChoco = cards.find(candidate => candidate.group === 'holomem' && candidate.jpName === '癒月ちょこ' && candidate.stage === '1st');
    const otherHolomen = cards.find(candidate => candidate.group === 'holomem' && candidate.number !== debutChoco?.number && candidate.number !== firstChoco?.number);
    assert.ok(debutChoco && firstChoco && otherHolomen && mascot);
    assert.match(mascot.abilityText, /HP\+20/u);
    assert.match(mascot.abilityText, /附著在〈癒月ちょこ〉身上/u);
    assert.match(mascot.abilityText, /Bloom時，回復該Holomen\s*20點HP/u);
    assert.match(mascot.abilityText, /每位自己的Holomen只能附著1張吉祥物/u);

    let battle = main(debutChoco.number);
    battle.players[0].zones.center.damage = 50;
    battle.players[0].zones.back1 = unit(otherHolomen.number);
    battle.players[0].hand = [inst(mascot.number, 'mascot-center'), inst(mascot.number, 'mascot-back'), inst(mascot.number, 'mascot-third')];
    battle = play(battle, 'mascot-center');
    assert.deepEqual(battle.pendingChoice?.options, ['center', 'back1']);
    battle = choose(battle, { zone: 'center' });
    assert.equal(battle.players[0].zones.center.attachments[0]?.number, mascot.number);

    battle = play(battle, 'mascot-back');
    assert.deepEqual(battle.pendingChoice?.options, ['back1'], 'a Holomen already carrying a mascot cannot receive another, while another Holomen can');
    battle = choose(battle, { zone: 'back1' });
    assert.throws(() => play(battle, 'mascot-third'), /沒有可附加/u, 'no own Holomen without a mascot remains');

    battle.players[0].hand.push(inst(firstChoco.number, 'choco-bloom'));
    battle = play(battle, 'choco-bloom');
    assert.ok(battle.pendingChoice?.options.includes('center'));
    battle = choose(battle, { zone: 'center' });
    assert.equal(battle.players[0].zones.center.damage, 30, 'the attached mascot heals its Choco by 20 when she Blooms');

    const makeHpTest = withMascot => {
      let hpBattle = state('AUDIT-TWENTY-ATTACKER', firstChoco.number);
      hpBattle.phase = 'performance';
      hpBattle.activePlayer = 1;
      hpBattle.players[0].zones.center = unit(firstChoco.number, {
        damage: Number(firstChoco.hp) - 20,
        attachments: withMascot ? [inst(mascot.number, 'hp-mascot')] : [],
      });
      hpBattle.players[1].zones.center = unit(twentyDamageHolomen.number);
      return applyAction(hpBattle, 1, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    };
    assert.ok(makeHpTest(true).players[0].zones.center, 'the +20 HP attachment lets the Holomen survive an otherwise lethal 20 damage');
    assert.equal(makeHpTest(false).players[0].zones.center, null, 'without the attachment, the same damage knocks the Holomen out');
  });
}
