import test from 'node:test';
import assert from 'node:assert/strict';
import { cards, pool, state, unit, inst, fund, attack } from './fixtures/simulator-audit.mjs';
const engineModule = await import(process.env.HOLO_ENGINE_TEST_TARGET || '../lib/simulator/engine.mjs');
const { applyAction } = engineModule;

const act = (game, action) => applyAction(structuredClone(game), 0, action, pool, () => 0);
const lunaiteNumber = cards.find((card) => card.jpName === 'ルーナイト')?.number;
const art = cards.find((card) => card.number === 'hBP03-014')?.arts?.[0];
const botanArt = cards.find((card) => card.number === 'hBP03-015')?.arts?.[0];

function lunaArtDamage({ attachedLunaite, opponentCard }) {
  const game = state('hBP03-014', opponentCard);
  const source = unit('hBP03-014', {
    attachments: attachedLunaite ? [inst(lunaiteNumber, 'lunaite')] : [],
  });
  game.players[0].zones.center = source;
  game.players[1].zones.center = unit(opponentCard);
  fund(source, art.cost);
  const result = act(game, attack);
  return result.players[1].zones.center.damage;
}

test('hBP03-014 Arts gains 50 only when its Luna has a Lounight attached', () => {
  assert.equal(lunaArtDamage({ attachedLunaite: true, opponentCard: 'hBP03-014' }), 150);
  assert.equal(lunaArtDamage({ attachedLunaite: false, opponentCard: 'hBP03-014' }), 100);
});

test('hBP03-014 applies its catalogued purple-target +50 independently of the Lounight condition', () => {
  assert.equal(lunaArtDamage({ attachedLunaite: false, opponentCard: 'hBP02-060' }), 150);
});

test('hBP03-015 applies its catalogued red-target +50', () => {
  const game = state('hBP03-015', 'hBP01-067');
  const source = unit('hBP03-015');
  game.players[0].zones.center = source;
  game.players[1].zones.center = unit('hBP01-067');
  fund(source, botanArt.cost);
  const result = act(game, attack);
  assert.equal(result.players[1].zones.center.damage, botanArt.damage + 50);
});
