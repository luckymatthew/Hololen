import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, inst, state, unit } from './fixtures/simulator-audit.mjs';

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
  const fan = card('hSD07-015');
  const flare = card('hSD07-004');
  const other = card('hSD07-011');
  const hitter = { ...dummy, number: 'AUDIT-HSD07-015-HITTER', hp: 10000, arts: [{ name: 'Audit hit', damage: 110, cost: [], effect: '' }] };
  const pool = [...cards, dummy, hitter];
  const choose = (battle, action) => applyAction(battle, 0, { type: 'choose', ...action }, pool, () => 0);
  const main = (source, target = dummy.number) => {
    const battle = state(source, target);
    battle.phase = 'main';
    return battle;
  };

  test(`${runtime.name}: hSD07-015 attaches only to own Flare and allows multiple copies on one Holomen`, () => {
    assert.equal(fan.typeCode, 'supportFan');
    assert.match(fan.abilityText, /HP\+10/u);
    assert.match(fan.abilityText, /只能裝備在自己的〈不知火フレア〉上/u);
    assert.match(fan.abilityText, /每位成員可裝備張數不限/u);

    let battle = main(flare.number);
    battle.players[0].hand = [inst(fan.number, 'fan-one')];
    battle = applyAction(battle, 0, { type: 'play', cardId: 'fan-one' }, pool, () => 0);
    assert.deepEqual(battle.pendingChoice?.options, ['center']);
    battle = choose(battle, { zone: 'center' });
    assert.deepEqual(battle.players[0].zones.center.attachments.map(instance => instance.id), ['fan-one']);

    battle.players[0].hand = [inst(fan.number, 'fan-two')];
    battle = applyAction(battle, 0, { type: 'play', cardId: 'fan-two' }, pool, () => 0);
    assert.deepEqual(battle.pendingChoice?.options, ['center']);
    battle = choose(battle, { zone: 'center' });
    assert.deepEqual(battle.players[0].zones.center.attachments.map(instance => instance.id), ['fan-one', 'fan-two']);
  });

  test(`${runtime.name}: two hSD07-015 copies each contribute 10 HP to knockout settlement`, () => {
    let battle = state(hitter.number, flare.number);
    battle.phase = 'performance';
    battle.players[0].zones.center = unit(hitter.number);
    battle.players[1].zones.center = unit(flare.number, {
      attachments: [inst(fan.number, 'hp-fan-one'), inst(fan.number, 'hp-fan-two')],
    });
    battle = applyAction(battle, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 110);
    assert.equal(battle.players[1].zones.center.stack.at(-1).number, flare.number, '100 base HP + 20 attachment HP survives 110 damage');
    assert.equal(battle.players[1].life.length, 5);
  });

  test(`${runtime.name}: hSD07-015 cannot be attached to a non-Flare Holomen`, () => {
    let battle = main(other.number);
    battle.players[0].hand = [inst(fan.number, 'fan-invalid-target')];
    assert.throws(() => applyAction(battle, 0, { type: 'play', cardId: 'fan-invalid-target' }, pool, () => 0), /沒有可附加/u);
  });
}
