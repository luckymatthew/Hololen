import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst } from './fixtures/simulator-audit.mjs';

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
  const yellCards = cards.filter(candidate => /^hY0[2-6]-\d{3}$/u.test(candidate.number) && String(candidate.abilityText || '').trim());
  const pool = [...cards, dummy, oshi];
  const card = number => cards.find(candidate => candidate.number === number);
  const act = (battle, action, playerIndex = 0) => applyAction(battle, playerIndex, action, pool, () => 0);

  test(`${runtime.name}: all ${yellCards.length} hY02–hY06 Yells archive with Holomen leaving stage`, () => {
    assert.equal(yellCards.length, 63, 'the audited catalog contains 63 non-empty hY02–hY06 Yell text slots');
    for (const yell of yellCards) {
      assert.equal(yell.group, 'cheer', `${yell.number} is a Cheer`);
      let battle = state('hSD19-002', dummy.number);
      battle.activePlayer = 1;
      battle.phase = 'performance';
      const cheerId = `leave-${yell.number}`;
      battle.players[0].zones.center = unit('hSD19-002', { cheer: [inst(yell.number, cheerId)] });
      battle.players[1].zones.center = unit(dummy.number);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, 1);
      assert.equal(battle.players[0].zones.center, null, `${yell.number}: attached Holomen leaves stage`);
      assert.equal(battle.players[0].archive.some(item => item.id === cheerId), true, `${yell.number}: attached Yell enters Archive`);
    }
  });

  test(`${runtime.name}: all ${yellCards.length} hY02–hY06 Yells archive only the printed Baton amount`, () => {
    const batonCost = Number(card('hSD19-002').baton);
    for (const yell of yellCards) {
      let battle = state('hSD19-002', 'hSD19-003');
      battle.phase = 'main';
      const paidIds = Array.from({ length: batonCost }, (_, index) => `baton-${yell.number}-${index}`);
      const retainedId = `baton-${yell.number}-retained`;
      battle.players[0].zones.center = unit('hSD19-002', {
        cheer: [...paidIds, retainedId].map(id => inst(yell.number, id)),
      });
      battle.players[0].zones.back1 = unit('hSD19-003');
      battle = act(battle, { type: 'baton', zone: 'back1' });
      assert.deepEqual(battle.players[0].archive.map(item => item.id), paidIds, `${yell.number}: only the printed Baton amount is archived`);
      assert.deepEqual(battle.players[0].zones.back1.cheer.map(item => item.id), [retainedId], `${yell.number}: excess Cheer remains attached to the moved Holomen`);
    }
  });
}
