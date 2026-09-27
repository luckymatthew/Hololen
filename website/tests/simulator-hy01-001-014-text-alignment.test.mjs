import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyAction as websiteApplyAction } from '../lib/simulator/engine.mjs';
import { cards as websiteCards, dummy, oshi, state, unit, inst } from './fixtures/simulator-audit.mjs';

const yellNumbers = Array.from({ length: 14 }, (_, index) => `hY01-${String(index + 1).padStart(3, '0')}`);
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

  test(`${runtime.name}: every hY01-001–014 Yell goes to Archive when its Holomen leaves stage`, () => {
    for (const number of yellNumbers) {
      let battle = state('hSD19-002', dummy.number);
      battle.activePlayer = 1;
      battle.phase = 'performance';
      battle.players[0].zones.center = unit('hSD19-002', { cheer: [inst(number, `leave-${number}`)] });
      battle.players[1].zones.center = unit(dummy.number);
      battle = act(battle, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, 1);
      assert.equal(battle.players[0].zones.center, null, `${number}: the attached Holomen was knocked out`);
      assert.equal(battle.players[0].archive.some(item => item.id === `leave-${number}`), true, `${number}: its attached Cheer enters Archive`);
    }
  });

  test(`${runtime.name}: every hY01-001–014 Yell pays exactly the printed Baton count to Archive`, () => {
    for (const number of yellNumbers) {
      const batonCost = Number(card('hSD19-002').baton);
      let battle = state('hSD19-002', 'hSD19-003');
      battle.phase = 'main';
      const paidIds = Array.from({ length: batonCost }, (_, index) => `baton-${number}-${index}`);
      const retainedId = `baton-${number}-retained`;
      battle.players[0].zones.center = unit('hSD19-002', {
        cheer: [...paidIds, retainedId].map(id => inst(number, id)),
      });
      battle.players[0].zones.back1 = unit('hSD19-003');
      battle = act(battle, { type: 'baton', zone: 'back1' });
      assert.deepEqual(battle.players[0].archive.map(item => item.id), paidIds, `${number}: exactly the printed Baton cost is archived`);
      assert.deepEqual(battle.players[0].zones.back1.cheer.map(item => item.id), [retainedId], `${number}: Cheer above the cost stays with the moved Holomen`);
      assert.equal(battle.players[0].zones.center.stack.at(-1).number, 'hSD19-003');
    }
  });
}
