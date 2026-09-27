import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst, fund } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const catalog = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, cards: catalog });
}

for (const runtime of runtimes) {
  const { applyAction, cards } = runtime;
  const pool = [...cards, dummy, oshi];
  const card = number => cards.find(candidate => candidate.number === number);
  const act = (battle, action, playerIndex = 0) => applyAction(battle, playerIndex, action, pool, () => 0);
  const choose = (battle, playerIndex, action) => act(battle, { type: 'choose', ...action }, playerIndex);
  const main = source => { const battle = state(source); battle.phase = 'main'; return battle; };
  const performance = source => { const battle = state(source); battle.phase = 'performance'; return battle; };

  test(`${runtime.name}: hSD13-010 both Arts charge Yellow and deal their printed 40/60`, () => {
    assert.deepEqual(card('hSD13-010').arts.map(art => [art.damage, art.cost]), [[40, ['黃']], [60, ['黃', '無色']]]);
    for (const [artIndex, expected] of [[0, 40], [1, 60]]) {
      let battle = performance('hSD13-010');
      fund(battle.players[0].zones.center, card('hSD13-010').arts[artIndex].cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex });
      assert.equal(battle.players[1].zones.center.damage, expected, `Arts ${artIndex + 1}`);
    }
  });

  test(`${runtime.name}: hSD13-011 Arts gains 20 only when no Holomen is underneath`, () => {
    const damage = hasUnder => {
      let battle = performance('hSD13-011');
      const top = inst('hSD13-011', 'gigi-1st');
      battle.players[0].zones.center = unit('hSD13-011', { stack: hasUnder ? [inst('hSD13-008', 'under-debut'), top] : [top] });
      fund(battle.players[0].zones.center, card('hSD13-011').arts[0].cost);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
      return battle.players[1].zones.center.damage;
    };
    assert.deepEqual([card('hSD13-011').arts[0].damage, card('hSD13-011').arts[0].cost], [40, ['黃', '無色']]);
    assert.equal(damage(false), 60, '40 base plus 20 with no Holomen under the source');
    assert.equal(damage(true), 40, 'the bonus is absent when a Debut Holomen is underneath');
  });

  test(`${runtime.name}: hSD13-011 Bloom may archive its underlying Debut for 20 special damage to opposing Collab`, () => {
    const bloom = () => {
      let battle = main('hSD13-003');
      battle.players[0].turnsTaken = 2;
      // The Bloom target must be a Gigi Debut. hSD13-003 is Elizabeth, so
      // using it here would make the fixture itself illegal before the effect runs.
      battle.players[0].zones.back1 = unit('hSD13-008', { enteredTurn: 0, stack: [inst('hSD13-008', 'gigi-debut')] });
      battle.players[0].hand = [inst('hSD13-011', 'gigi-1st-bloom')];
      battle.players[1].zones.collab = unit('hSD13-003');
      battle = act(battle, { type: 'play', cardId: 'gigi-1st-bloom' });
      assert.equal(battle.pendingChoice?.type, 'bloom');
      battle = choose(battle, 0, { zone: 'back1' });
      assert.equal(battle.pendingChoice?.effect, 'gigiBloomDebutCost');
      assert.deepEqual(battle.pendingChoice.selectableIds, ['gigi-debut']);
      return battle;
    };

    let paid = choose(bloom(), 0, { cardIds: ['gigi-debut'] });
    assert.ok(paid.players[0].archive.some(instance => instance.id === 'gigi-debut'));
    assert.equal(paid.players[1].zones.collab.damage, 20, 'paying the optional Debut cost deals 20 special damage to Collab');

    const skipped = choose(bloom(), 0, { skip: true });
    assert.equal(skipped.players[0].zones.back1.stack[0].id, 'gigi-debut', 'declining the optional cost leaves the Debut underneath');
    assert.equal(skipped.players[0].archive.some(instance => instance.id === 'gigi-debut'), false);
    assert.equal(skipped.players[1].zones.collab.damage, 0, 'declining does not deal special damage');
  });

  test(`${runtime.name}: hSD13-012 Arts deals 60 for Yellow plus Colorless`, () => {
    assert.deepEqual([card('hSD13-012').arts[0].damage, card('hSD13-012').arts[0].cost], [60, ['黃', '無色']]);
    let battle = performance('hSD13-012');
    fund(battle.players[0].zones.center, card('hSD13-012').arts[0].cost);
    battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
    assert.equal(battle.players[1].zones.center.damage, 60);
  });

  test(`${runtime.name}: hSD13-012 Gift can archive one underlying Holomen to prevent opponent special damage to the Back this turn`, () => {
    const setup = hasUnder => {
      let battle = main('hSD13-003');
      battle.activePlayer = 1;
      battle.players[1].turnsTaken = 2;
      battle.players[1].zones.back1 = unit('hSD12-003');
      battle.players[1].mainDeck = [inst('hSD13-003', 'collab-power'), inst('hSD13-003', 'deck-left')];
      battle.players[0].zones.back1 = unit('hSD13-012', {
        stack: hasUnder ? [inst('hSD13-010', 'shield-cost'), inst('hSD13-012', 'shield-gigi')] : [inst('hSD13-012', 'shield-gigi')],
      });
      battle.players[0].zones.back2 = unit('hSD13-010');
      battle = act(battle, { type: 'collab', zone: 'back1' }, 1);
      assert.equal(battle.pendingChoice?.effect, 'specialDamage');
      assert.ok(battle.pendingChoice.options.includes('back2'));
      battle = choose(battle, 1, { zone: 'back2' });
      return battle;
    };

    let battle = setup(true);
    assert.equal(battle.pendingChoice?.effect, 'giftDamageReaction');
    assert.ok(battle.pendingChoice.modeOptions.some(option => option.id === 'gigiShield:back1'));
    battle = choose(battle, 0, { optionId: 'gigiShield:back1' });
    assert.equal(battle.pendingChoice?.effect, 'giftArchiveUnderForBackShield');
    assert.deepEqual(battle.pendingChoice.selectableIds, ['shield-cost']);
    battle = choose(battle, 0, { cardIds: ['shield-cost'] });
    assert.equal(battle.players[0].zones.back2.damage, 0, 'the queued incoming special damage is prevented');
    assert.equal(battle.players[0].zones.back1.stack.length, 1, 'one underlying Holomen is archived as the activation cost');
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'shield-cost'));
    assert.ok(battle.players[0].modifiers.some(modifier => modifier.kind === 'backSpecialImmune' && modifier.expiresTurn === battle.turn), 'protection applies to the whole own Back for this turn');

    battle = setup(true);
    battle = choose(battle, 0, { skip: true });
    assert.equal(battle.players[0].zones.back2.damage, 10, 'declining the optional Gift lets the special damage resolve');
    assert.equal(battle.players[0].zones.back1.stack.length, 2, 'declining leaves the underlying Holomen in place');

    battle = setup(false);
    assert.equal(battle.pendingChoice, null, 'the Gift is not offered when there is no underlying Holomen to archive');
    assert.equal(battle.players[0].zones.back2.damage, 10);
  });

  test(`${runtime.name}: hSD13-013 Arts adds 90 with no Holomen underneath and +50 against White`, () => {
    const arts = card('hSD13-013').arts[0];
    assert.deepEqual([arts.damage, arts.cost, arts.specialTargets, arts.specialValues], [90, ['黃', '無色', '無色', '無色'], ['白'], [50]]);
    const attack = hasUnder => {
      let battle = performance('hSD13-013');
      const sourceTop = inst('hSD13-013', 'gigi-2nd');
      battle.players[0].zones.center = unit('hSD13-013', {
        stack: hasUnder ? [inst('hSD13-011', 'gigi-under'), sourceTop] : [sourceTop],
        cheer: [inst('hY06-001', 'arts-yellow'), inst('hY01-001', 'arts-colorless-1'), inst('hY01-001', 'arts-colorless-2'), inst('hY01-001', 'arts-colorless-3')],
      });
      battle.players[1].zones.center = unit('hBP02-017');
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 });
      return battle.players[1].zones.center.damage;
    };
    assert.equal(attack(false), 230, '90 base + 90 with no Holomen underneath + 50 against White');
    assert.equal(attack(true), 140, 'an underlying Holomen removes the conditional 90 but not White special damage');
  });

  test(`${runtime.name}: hSD13-013 Gift archives one underlying Holomen and attaches exactly the Cheer Deck top to its source`, () => {
    let battle = main('hSD13-013');
    battle.players[0].zones.center = unit('hSD13-013', { stack: [inst('hSD13-008', 'gift-under'), inst('hSD13-013', 'gift-source')] });
    battle.players[0].cheerDeck = [inst('hY03-001', 'gift-top'), inst('hY06-001', 'gift-next')];

    battle = act(battle, { type: 'giftSkill', zone: 'center' });
    assert.equal(battle.pendingChoice?.effect, 'giftGigiUnderCost');
    assert.equal(battle.pendingChoice.optional, true);
    assert.deepEqual(battle.pendingChoice.selectableIds, ['gift-under']);
    battle = choose(battle, 0, { cardIds: ['gift-under'] });
    assert.ok(battle.players[0].archive.some(instance => instance.id === 'gift-under'));
    assert.equal(battle.pendingChoice?.type, 'eventCheerTarget');
    assert.deepEqual(battle.pendingChoice.options, ['center'], 'the Cheer is attached to the Gift source itself');
    battle = choose(battle, 0, { zone: 'center' });
    assert.deepEqual(battle.players[0].zones.center.cheer.map(instance => instance.id), ['gift-top']);
    assert.deepEqual(battle.players[0].cheerDeck.map(instance => instance.id), ['gift-next'], 'one top Cheer is attached and the rest stay in the Cheer Deck');
    assert.throws(() => act(battle, { type: 'giftSkill', zone: 'center' }), /每回合 1 次 Gift 本回合已使用/u);
  });
}
