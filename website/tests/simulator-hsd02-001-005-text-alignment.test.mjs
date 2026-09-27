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
for (const runtime of runtimes) runtime.pool = [...runtime.cards, dummy];

const choose = (runtime, battle, action, random = () => 0) => runtime.applyAction(battle, 0, { type: 'choose', ...action }, runtime.pool, random);
const fresh = () => state('hSD02-002', 'AUDIT-DUMMY');
const main = () => {
  const battle = fresh();
  battle.phase = 'main';
  return battle;
};
const performance = () => {
  const battle = fresh();
  battle.phase = 'performance';
  return battle;
};

for (const runtime of runtimes) {
  const { cards, pool, applyAction } = runtime;
  const redHolomem = cards.find(card => card.group === 'holomem' && card.colors.includes('紅') && card.arts?.length);
  const nonRedHolomem = cards.find(card => card.group === 'holomem' && !card.colors.includes('紅') && card.arts?.length);
  const limitedDebut = cards.find(card => card.group === 'holomem' && card.stage === 'Debut' && !card.unlimited);
  const poyo = cards.find(card => card.group === 'support' && card.typeCode === 'supportMascot' && /ぽよ余/u.test(`${card.name} ${card.jpName}`));
  const unlimitedDebut = cards.find(card => card.number === 'hSD02-002');
  assert.ok(redHolomem && nonRedHolomem && limitedDebut && poyo && unlimitedDebut, 'catalog needs Oshi, color, mascot and unlimited-Debut fixtures');

  test(`${runtime.name}: hSD02-001 Red Microphone costs two Power, buffs Red Center +20, and is once per turn`, () => {
    let battle = main();
    battle.players[0].oshi = inst('hSD02-001');
    battle.players[0].zones.center = unit('hSD02-002');
    battle.players[0].holoPower = [inst('AUDIT-DUMMY', 'power-1'), inst('AUDIT-DUMMY', 'power-2')];
    battle = applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0);
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.equal(battle.players[0].oshiSkillTurn, battle.turn);
    fund(battle.players[0].zones.center, ['紅']);
    battle.phase = 'performance';
    battle = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 50, '30 base Arts +20 Red Microphone');
    battle.players[0].holoPower = [inst('AUDIT-DUMMY', 'later-1'), inst('AUDIT-DUMMY', 'later-2')];
    battle.phase = 'main';
    assert.throws(() => applyAction(battle, 0, { type: 'oshiSkill' }, pool, () => 0), /本回合已使用|每回合/u);

    let wrongColor = main();
    wrongColor.players[0].oshi = inst('hSD02-001');
    wrongColor.players[0].zones.center = unit(nonRedHolomem.number);
    wrongColor.players[0].holoPower = [inst('AUDIT-DUMMY', 'power-1'), inst('AUDIT-DUMMY', 'power-2')];
    assert.throws(() => applyAction(wrongColor, 0, { type: 'oshiSkill' }, pool, () => 0), /不是紅色/u);
    assert.equal(wrongColor.players[0].holoPower.length, 2, 'invalid color must not pay');
  });

  test(`${runtime.name}: hSD02-001 SP costs one Power and takes exactly one archived Red Holomen`, () => {
    let battle = main();
    battle.players[0].oshi = inst('hSD02-001');
    battle.players[0].holoPower = [inst('AUDIT-DUMMY', 'sp-power')];
    battle.players[0].archive = [inst(redHolomem.number, 'red-holomem'), inst(nonRedHolomem.number, 'non-red-holomem')];
    battle = applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0);
    assert.equal(battle.players[0].holoPower.length, 0);
    assert.equal(battle.players[0].pendingChoice, undefined);
    assert.equal(battle.pendingChoice?.effect, 'archiveToHand');
    assert.deepEqual(battle.pendingChoice.selectableIds, ['red-holomem']);
    battle = choose(runtime, battle, { cardIds: ['red-holomem'] });
    assert.deepEqual(battle.players[0].hand.map(card => card.id), ['red-holomem']);
    assert.ok(battle.players[0].archive.some(card => card.id === 'non-red-holomem'));
    battle.players[0].holoPower = [inst('AUDIT-DUMMY', 'later-power')];
    assert.throws(() => applyAction(battle, 0, { type: 'spOshiSkill' }, pool, () => 0), /已使用|once|1次/u);
  });

  test(`${runtime.name}: hSD02-002 Red Arts is 30 for one Red Cheer and unlimited-Debut text is engine-recognized`, () => {
    assert.equal(unlimitedDebut.stage, 'Debut');
    assert.match(unlimitedDebut.extra, /任意張數/u);
    assert.equal(unlimitedDebut.unlimited, true);
    assert.equal(unlimitedDebut.arts[0].damage, 30);
    assert.deepEqual(unlimitedDebut.arts[0].cost, ['紅']);
    let arts = performance();
    arts.players[0].zones.center = unit(unlimitedDebut.number);
    fund(arts.players[0].zones.center, unlimitedDebut.arts[0].cost);
    arts = applyAction(arts, 0, attack, pool, () => 0);
    assert.equal(arts.players[1].zones.center.damage, 30);

    let battle = main();
    battle.players[0].hand = [inst('hBP08-091', 'creator')];
    battle.players[0].mainDeck = [inst(unlimitedDebut.number, 'copy-1'), inst(unlimitedDebut.number, 'copy-2'), inst(unlimitedDebut.number, 'copy-3'), inst(limitedDebut.number, 'ordinary-debut')];
    battle.players[0].archive = [inst(unlimitedDebut.number, 'archived-copy')];
    battle = applyAction(battle, 0, { type: 'play', cardId: 'creator' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.effect, 'deckCardsToStage');
    assert.deepEqual(battle.pendingChoice.selectableIds, ['copy-1', 'copy-2', 'copy-3']);
  });

  test(`${runtime.name}: hSD02-003 Colorless Arts is 30 and Collab deals 10 special damage only to opponent Collab`, () => {
    const card = cards.find(candidate => candidate.number === 'hSD02-003');
    assert.equal(card.arts[0].damage, 30);
    assert.deepEqual(card.arts[0].cost, ['無色']);
    let arts = performance();
    arts.players[0].zones.center = unit(card.number);
    fund(arts.players[0].zones.center, card.arts[0].cost);
    arts = applyAction(arts, 0, attack, pool, () => 0);
    assert.equal(arts.players[1].zones.center.damage, 30);

    let battle = main();
    battle.players[0].zones.back1 = unit(card.number);
    battle.players[0].mainDeck = [inst('AUDIT-DUMMY', 'collab-power')];
    battle.players[1].zones.collab = unit('AUDIT-DUMMY');
    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.players[1].zones.collab.damage, 10);

    let noCollab = main();
    noCollab.players[0].zones.back1 = unit(card.number);
    noCollab.players[0].mainDeck = [inst('AUDIT-DUMMY', 'collab-power')];
    noCollab = applyAction(noCollab, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(noCollab.pendingChoice, null);
    assert.equal(noCollab.players[1].zones.center.damage, 0);
  });

  test(`${runtime.name}: hSD02-004 grants Center +20 Arts only when its Collab source has Poyo余`, () => {
    const card = cards.find(candidate => candidate.number === 'hSD02-004');
    assert.equal(card.arts[0].damage, 30);
    assert.deepEqual(card.arts[0].cost, ['紅']);
    const resolve = withPoyo => {
      let battle = main();
      battle.players[0].zones.center = unit('hSD02-002');
      battle.players[0].zones.back1 = unit(card.number, withPoyo ? { attachments: [inst(poyo.number, 'poyo')] } : {});
      battle.players[0].mainDeck = [inst('AUDIT-DUMMY', 'collab-power')];
      battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
      fund(battle.players[0].zones.center, ['紅']);
      battle.phase = 'performance';
      return applyAction(battle, 0, attack, pool, () => 0).players[1].zones.center.damage;
    };
    assert.equal(resolve(false), 30);
    assert.equal(resolve(true), 50);
  });

  test(`${runtime.name}: hSD02-005 Arts damage and both Cheer costs match`, () => {
    const card = cards.find(candidate => candidate.number === 'hSD02-005');
    assert.deepEqual(card.arts.map(art => [art.damage, art.cost]), [[20, ['無色']], [60, ['紅', '無色']]]);
    for (const [artIndex, damage] of [[0, 20], [1, 60]]) {
      let battle = performance();
      battle.players[0].zones.center = unit(card.number);
      fund(battle.players[0].zones.center, card.arts[artIndex].cost);
      battle = applyAction(battle, 0, { ...attack, artIndex }, pool, () => 0);
      assert.equal(battle.players[1].zones.center.damage, damage);
    }
  });
}
