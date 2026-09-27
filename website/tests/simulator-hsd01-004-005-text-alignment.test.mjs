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
  const cards = JSON.parse(readFileSync(androidCardsUrl, 'utf8')).cards;
  runtimes.push({ name: 'Android source', applyAction: engine.applyAction, cards });
}
for (const runtime of runtimes) runtime.pool = [...runtime.cards, dummy];

for (const runtime of runtimes) {
  const { applyAction, cards, pool } = runtime;

  test(`${runtime.name}: hSD01-004 basic Arts costs one Colorless Cheer and deals 20`, () => {
    const card = cards.find(candidate => candidate.number === 'hSD01-004');
    assert.equal(card.arts[0].damage, 20);
    assert.deepEqual(card.arts[0].cost, ['無色']);

    const unfunded = state('hSD01-004');
    assert.throws(() => applyAction(unfunded, 0, attack, pool, () => 0), /應援不足/u);
    const battle = state('hSD01-004');
    fund(battle.players[0].zones.center, ['無色']);
    const result = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(result.players[1].zones.center.damage, 20);
  });

  test(`${runtime.name}: hSD01-004 Collab gives only own Center +20 Arts for the current turn`, () => {
    let battle = state('hSD01-003');
    battle.phase = 'main';
    battle.players[0].zones.back1 = unit('hSD01-004');

    battle = applyAction(battle, 0, { type: 'collab', zone: 'back1' }, pool, () => 0);
    assert.equal(battle.players[0].zones.collab.stack.at(-1).number, 'hSD01-004');
    assert.equal(battle.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 20 && modifier.expiresTurn === battle.turn), true);
    assert.equal(battle.players[0].zones.collab.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 20), false,
      'the text buffs Center, not the Holomem that Collabed');

    battle.phase = 'performance';
    fund(battle.players[0].zones.center, ['無色']);
    battle = applyAction(battle, 0, attack, pool, () => 0);
    assert.equal(battle.players[1].zones.center.damage, 50, 'the printed hSD01-003 Arts 30 receives exactly the current-turn +20');
  });

  test(`${runtime.name}: hSD01-005 first Arts is 30 for White; second is 50 for White plus Colorless`, () => {
    const card = cards.find(candidate => candidate.number === 'hSD01-005');
    assert.deepEqual(card.arts.map(art => ({ damage: art.damage, cost: art.cost })), [
      { damage: 30, cost: ['白'] },
      { damage: 50, cost: ['白', '無色'] },
    ]);

    const first = state('hSD01-005');
    fund(first.players[0].zones.center, ['白']);
    const firstResult = applyAction(first, 0, { ...attack, artIndex: 0 }, pool, () => 0);
    assert.equal(firstResult.players[1].zones.center.damage, 30);

    const secondUnderfunded = state('hSD01-005');
    fund(secondUnderfunded.players[0].zones.center, ['白']);
    assert.throws(() => applyAction(secondUnderfunded, 0, { ...attack, artIndex: 1 }, pool, () => 0), /應援不足/u);
    const second = state('hSD01-005');
    fund(second.players[0].zones.center, ['白', '無色']);
    const secondResult = applyAction(second, 0, { ...attack, artIndex: 1 }, pool, () => 0);
    assert.equal(secondResult.players[1].zones.center.damage, 50);
  });
}
