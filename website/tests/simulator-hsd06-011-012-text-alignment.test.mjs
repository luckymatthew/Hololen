import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction, legalAttachmentTargets as websiteLegalAttachmentTargets } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, fund, inst, state, unit } from './fixtures/simulator-audit.mjs';

const runtimes = [{ name: 'Website', applyAction: websiteApplyAction, legalAttachmentTargets: websiteLegalAttachmentTargets, cards: websiteCards }];
const androidEngineUrl = new URL('../../../android-current/web/lib/simulator/engine.mjs', import.meta.url);
const androidCardsUrl = new URL('../../../android-current/app/src/main/assets/cards.json', import.meta.url);
if (existsSync(fileURLToPath(androidEngineUrl)) && existsSync(fileURLToPath(androidCardsUrl))) {
  const engine = await import(androidEngineUrl.href);
  const cards = JSON.parse(readFileSync(fileURLToPath(androidCardsUrl), 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, legalAttachmentTargets: engine.legalAttachmentTargets, cards });
}

for (const runtime of runtimes) {
  const { cards, applyAction, legalAttachmentTargets } = runtime;
  const card = number => cards.find(candidate => candidate.number === number);
  const tool = card('hSD06-011');
  const mascot = card('hSD06-012');
  const irohaFirst = card('hSD06-004');
  const irohaDebut = card('hSD06-002');
  const nonIroha = { ...dummy, number: 'AUDIT-NON-IROHA-160', hp: 160, jpName: 'Audit member', name: 'Audit member' };
  const target = { ...dummy, number: 'AUDIT-HSD06-TARGET', hp: 10000, arts: [{ name: 'No attack', damage: 0, cost: [], effect: '' }] };
  const hitter = damage => ({ ...dummy, number: `AUDIT-HSD06-HITTER-${damage}`, hp: 10000, arts: [{ name: 'Audit hit', damage, cost: [], effect: '' }] });
  const pool = [...cards, dummy, nonIroha, target, hitter(40), hitter(70), hitter(175), hitter(180)];
  const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);

  test(`${runtime.name}: hSD06-011 can be played onto an eligible own Holomen and grants Arts +10`, () => {
    assert.match(tool.abilityText, /Arts\+10/u);
    let battle = state(irohaFirst.number, target.number);
    battle.phase = 'main';
    battle.players[0].hand = [inst(tool.number, 'chaki-hand')];
    battle = applyAction(battle, 0, { type: 'play', cardId: 'chaki-hand' }, pool, () => 0);
    assert.equal(battle.pendingChoice?.type, 'attachSupport');
    assert.deepEqual(battle.pendingChoice.options, ['center']);
    battle = choose(battle, { zone: 'center' });
    assert.ok(battle.players[0].zones.center.attachments.some(instance => instance.id === 'chaki-hand'));

    const source = battle.players[0].zones.center;
    fund(source, irohaFirst.arts[0].cost);
    battle.phase = 'performance';
    battle.players[1].zones.center = unit(target.number);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, irohaFirst.arts[0].damage + 10);
  });

  test(`${runtime.name}: hSD06-011 permits one Tool per own Holomen`, () => {
    const owner = state(irohaFirst.number).players[0];
    owner.zones.center.attachments = [inst(tool.number, 'existing-chaki')];
    assert.deepEqual(legalAttachmentTargets(owner, tool, cards), []);
  });

  test(`${runtime.name}: hSD06-011 deals one 20 special-damage counter per opposing turn`, () => {
    const attacker40 = hitter(40);
    let battle = state(attacker40.number, irohaFirst.number);
    battle.phase = 'performance';
    battle.players[0].zones.center = unit(attacker40.number, { id: 'attacker-center' });
    battle.players[0].zones.collab = unit(attacker40.number, { id: 'attacker-collab' });
    battle.players[1].zones.center = unit(irohaFirst.number, { attachments: [inst(tool.number, 'chaki') ] });
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[0].zones.center.damage, 20, 'the attached Iroha deals 20 special damage during the opponent turn');
    assert.equal(battle.players[1].zones.center.damage, 40);
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[0].zones.center.damage, 20, 'a second hit in the same turn does not repeat the once-per-turn effect');
    assert.equal(battle.players[1].zones.center.damage, 80);
  });

  test(`${runtime.name}: hSD06-011's extra ability requires a 1st-or-higher Iroha`, () => {
    let battle = state(dummy.number, irohaDebut.number);
    battle.phase = 'performance';
    battle.players[0].zones.center = unit(hitter(40).number);
    battle.players[1].zones.center = unit(irohaDebut.number, { attachments: [inst(tool.number, 'chaki')] });
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 40);
    assert.equal(battle.players[0].zones.center.damage, 0, "Debut Iroha does not receive the Tool's additional ability");
  });

  test(`${runtime.name}: hSD06-011 counter knockout does not reduce Life`, () => {
    const fragileAttacker = { ...hitter(40), hp: 20 };
    const fragilePool = [...pool, fragileAttacker];
    let battle = state(fragileAttacker.number, irohaFirst.number);
    battle.phase = 'performance';
    battle.players[0].zones.center = unit(fragileAttacker.number);
    battle.players[1].zones.center = unit(irohaFirst.number, { attachments: [inst(tool.number, 'chaki')] });
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, fragilePool, () => 0);
    assert.equal(battle.players[0].zones.center, null, '20 counter damage knocks out the 20-HP attacker');
    assert.equal(battle.players[0].life.length, 5, 'Chaki丸 says this knockout does not reduce Life');
  });

  test(`${runtime.name}: hSD06-012 grants Iroha the printed total HP +30`, () => {
    assert.match(mascot.abilityText, /HP\+10/u);
    assert.match(mascot.abilityText, /風真いろは[\s\S]*HP\+20/u);
    let battle = state(hitter(180).number, irohaFirst.number);
    battle.phase = 'performance';
    battle.players[0].zones.center = unit(hitter(180).number);
    battle.players[1].zones.center = unit(irohaFirst.number, { attachments: [inst(mascot.number, 'pokobee') ] });
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.ok(battle.players[1].zones.center, 'Iroha has 190 HP including the base +10 and conditional +20');
    assert.equal(battle.players[1].zones.center.damage, 180);
  });

  test(`${runtime.name}: hSD06-012's conditional +20 does not apply to another Holomen`, () => {
    let battle = state(hitter(180).number, nonIroha.number);
    battle.phase = 'performance';
    battle.players[0].zones.center = unit(hitter(180).number);
    battle.players[1].zones.center = unit(nonIroha.number, { attachments: [inst(mascot.number, 'pokobee') ] });
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center, null, "a non-Iroha has only the Mascot's base +10 HP");
  });

  test(`${runtime.name}: hSD06-012 permits one Mascot per own Holomen`, () => {
    const owner = state(irohaFirst.number).players[0];
    owner.zones.center.attachments = [inst(mascot.number, 'existing-pokobee')];
    assert.deepEqual(legalAttachmentTargets(owner, mascot, cards), []);
  });
}
