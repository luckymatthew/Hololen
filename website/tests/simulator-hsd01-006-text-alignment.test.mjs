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

  test(`${runtime.name}: hSD01-006 basic Arts has 50 damage and White plus Colorless cost`, () => {
    const card = cards.find(candidate => candidate.number === 'hSD01-006');
    assert.deepEqual(card.arts[0].cost, ['白', '無色']);
    assert.equal(card.arts[0].damage, 50);
    const battle = state('hSD01-006');
    fund(battle.players[0].zones.center, ['白', '無色']);
    const result = applyAction(battle, 0, { ...attack, artIndex: 0 }, pool, () => 0);
    assert.equal(result.players[1].zones.center.damage, 50);
  });

  for (const hasAzki of [false, true]) {
    test(`${runtime.name}: hSD01-006 second Arts is 60${hasAzki ? ' + 50 with own AZKi' : ' without own AZKi'}`, () => {
      const card = cards.find(candidate => candidate.number === 'hSD01-006');
      assert.deepEqual(card.arts[1].cost, ['白', '綠', '無色']);
      assert.equal(card.arts[1].damage, 60);
      let battle = state('hSD01-006');
      fund(battle.players[0].zones.center, card.arts[1].cost);
      if (hasAzki) {
        const azki = cards.find(candidate => candidate.group === 'holomem' && candidate.jpName === 'AZKi' && candidate.stage === 'Debut');
        assert.ok(azki);
        battle.players[0].zones.back1 = unit(azki.number);
      }
      battle = applyAction(battle, 0, { ...attack, artIndex: 1 }, pool, () => 0);
      assert.equal(battle.players[1].zones.center.damage, hasAzki ? 110 : 60);
    });
  }

  test(`${runtime.name}: hSD01-006 Extra makes its own knockout remove two LIFE`, () => {
    const card = cards.find(candidate => candidate.number === 'hSD01-006');
    assert.equal(card.type, 'Buzz Holomen', 'the local catalog marks this as a Buzz member');
    assert.match(card.extra, /被擊倒時/u);
    assert.match(card.extra, /生命.{0,4}-2/u);
    let battle = state('AUDIT-DUMMY', 'hSD01-006');
    battle.phase = 'performance';
    battle.players[1].zones.center.damage = 200;
    battle.players[1].zones.back1 = unit('AUDIT-DUMMY');
    battle.players[1].life = Array.from({ length: 5 }, (_, index) => inst('hY01-001', `life-${index}`));
    battle = applyAction(battle, 0, attack, pool, () => 0);

    assert.equal(battle.players[1].life.length, 3, 'the printed Extra is a total two-LIFE loss on this knockout');
    assert.equal(battle.players[1].zones.center, null);
  });
}
