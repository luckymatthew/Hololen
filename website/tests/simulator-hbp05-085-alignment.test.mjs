import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, state, inst } from './fixtures/simulator-audit.mjs';

const miko = cards.find(card => card.number === 'hBP05-035');
const koAttacker = {
  number: 'AUDIT-MIKODANYE-KO',
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

test('MikoDanye forces its owner to archive one hand card when attached Miko is KO’d on the opponent turn', () => {
  assert.ok(miko, 'the fixture must include hBP05-035 Sakura Miko');
  let game = state(miko.number, koAttacker.number);
  game.turn = 4;
  game.phase = 'performance';
  game.activePlayer = 1;
  game.players[0].zones.center.damage = miko.hp - 10;
  game.players[0].zones.center.attachments = [inst('hBP05-085', 'miko-danye')];
  game.players[1].hand = [inst('AUDIT-DUMMY', 'forced-archive')];

  game = applyAction(game, 1, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, testCards, () => 0);
  assert.equal(game.pendingChoice?.effect, 'handToArchive');
  assert.equal(game.pendingChoice?.optional, false);
  assert.deepEqual(game.pendingChoice?.selectableIds, ['forced-archive']);

  game = applyAction(game, 1, { type: 'choose', cardIds: ['forced-archive'] }, testCards, () => 0);
  assert.ok(game.players[1].archive.some(card => card.id === 'forced-archive'));
  assert.ok(!game.players[1].hand.some(card => card.id === 'forced-archive'));
});
