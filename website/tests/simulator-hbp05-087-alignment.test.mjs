import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, state, unit, inst } from './fixtures/simulator-audit.mjs';

const nerissa = cards.find(card => card.number === 'hBP05-059');
const singer = cards.find(card => card.group === 'holomem' && card.tags?.includes('#歌') && card.number !== nerissa.number);
const koAttacker = {
  number: 'AUDIT-JAILBIRD-KO',
  name: 'Audit KO attacker',
  jpName: '監査用攻擊者',
  group: 'holomem',
  stage: '2nd',
  hp: 200,
  colors: [],
  tags: [],
  baton: 0,
  arts: [{ name: 'KO hit', damage: 30, cost: [], effect: '' }],
};
const testCards = [...pool, koAttacker];

test('each attached Jailbird grants its own one-Cheer transfer trigger when Nerissa is KO’d', () => {
  assert.ok(nerissa && singer, 'the fixture must include Nerissa and another #歌 Holomen');
  let game = state(nerissa.number, koAttacker.number);
  game.turn = 4;
  game.phase = 'performance';
  game.activePlayer = 1;
  const defeated = game.players[0].zones.center;
  defeated.damage = nerissa.hp - 10;
  defeated.cheer = [inst('hY01-001', 'cheer-one'), inst('hY02-001', 'cheer-two')];
  defeated.attachments = [inst('hBP05-087', 'jailbird-one'), inst('hBP05-087', 'jailbird-two')];
  game.players[0].zones.back1 = unit(singer.number);

  game = applyAction(game, 1, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, testCards, () => 0);
  const pendingFanCount = Number(game.pendingChoice?.effect === 'koFanTransferPick' || game.pendingChoice?.effect === 'koTransferCheer')
    + game.effectQueue.filter(effect => effect.type === 'koFanTransfer' || effect.effect === 'koTransferCheer').length;
  assert.equal(pendingFanCount, 2, 'both physical copies can trigger; the knocked-out Nerissa is excluded as a destination');

  const firstId = game.pendingChoice.selectableIds[0];
  game = applyAction(game, 0, { type: 'choose', cardIds: [firstId] }, testCards, () => 0);
  assert.equal(game.pendingChoice?.type, 'stageTarget');
  assert.deepEqual(game.pendingChoice?.options, ['back1']);
  game = applyAction(game, 0, { type: 'choose', zone: 'back1' }, testCards, () => 0);

  assert.equal(game.pendingChoice?.effect, 'koFanTransferPick');
  assert.equal(game.pendingChoice?.optional, true);
  assert.equal(game.pendingChoice?.selectableIds.length, 1, 'the second trigger only offers a Cheer that was not already transferred');
  const secondId = game.pendingChoice.selectableIds[0];
  assert.notEqual(secondId, firstId);
  game = applyAction(game, 0, { type: 'choose', cardIds: [secondId] }, testCards, () => 0);
  game = applyAction(game, 0, { type: 'choose', zone: 'back1' }, testCards, () => 0);
  assert.deepEqual(game.players[0].zones.back1.cheer.map(cheer => cheer.id), ['cheer-one', 'cheer-two']);
});
