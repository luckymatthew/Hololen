import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, dummy, inst, unit, state, attack } from './fixtures/simulator-audit.mjs';

const cardNamed = (name, predicate = () => true) => cards.find(card => card.jpName?.includes(name) && predicate(card));
const support = (s, number, id = `support-${number}`) => {
  s.phase = 'main';
  s.players[0].hand.push(inst(number, id));
  return applyAction(s, 0, { type: 'play', cardId: id }, pool, () => 0);
};
const resolveSearchPair = (s, firstId, secondId) => {
  s = applyAction(s, 0, { type: 'choose', cardIds: [firstId] }, pool, () => 0);
  return applyAction(s, 0, { type: 'choose', cardIds: [secondId] }, pool, () => 0);
};

test('hBP08-090 returns one to three Mascots or Fans, then draws two', () => {
  const attachments = cards.filter(card => card.group === 'support' && ['supportMascot', 'supportFan'].includes(card.typeCode));
  const tool = cards.find(card => card.group === 'support' && card.typeCode === 'supportTool');
  const event = cards.find(card => card.group === 'support' && ['supportEvent', 'supportEventLimited'].includes(card.typeCode));
  assert.ok(attachments.length >= 4 && tool && event);
  let s = state();
  s.players[0].archive = [...attachments.slice(0, 4), tool, event].map((card, i) => inst(card.number, `arch-${i}`));
  s.players[0].mainDeck = Array.from({ length: 8 }, (_, i) => inst(dummy.number, `deck-${i}`));
  s = support(s, 'hBP08-090');
  assert.equal(s.pendingChoice.effect, 'archiveSupportToDeckDraw');
  assert.equal(s.pendingChoice.min, 1);
  assert.equal(s.pendingChoice.max, 3);
  assert.deepEqual(new Set(s.pendingChoice.cards.map(card => card.id)), new Set(['arch-0', 'arch-1', 'arch-2', 'arch-3']));
  s = applyAction(s, 0, { type: 'choose', cardIds: ['arch-0', 'arch-2'] }, pool, () => 0);
  assert.equal(s.players[0].hand.length, 2);
  assert.equal(s.players[0].archive.some(card => card.id === 'arch-0' || card.id === 'arch-2'), false);
  assert.equal(s.players[0].archive.some(card => card.id === 'arch-3' || card.id === 'arch-4' || card.id === 'arch-5'), true);
  assert.equal(['arch-0', 'arch-2'].every(id => s.players[0].hand.some(card => card.id === id) || s.players[0].mainDeck.some(card => card.id === id)), true);
});

test('hBP08-092 searches Fuwawa and Mococo and applies the lower-Life special damage', () => {
  const fuwawa = cardNamed('フワワ・アビスガード', card => card.stage === 'Debut');
  const mococo = cardNamed('モココ・アビスガード', card => card.stage === 'Debut');
  assert.ok(fuwawa && mococo);
  let s = state();
  s.players[0].life = s.players[0].life.slice(0, 4);
  s.players[0].mainDeck = [inst(fuwawa.number, 'fuwawa'), inst(dummy.number, 'filler'), inst(mococo.number, 'mococo')];
  s = support(s, 'hBP08-092');
  assert.equal(s.pendingChoice.effect, 'donutFuwawa');
  s = resolveSearchPair(s, 'fuwawa', 'mococo');
  assert.equal(s.players[0].hand.some(card => card.id === 'fuwawa'), true);
  assert.equal(s.players[0].hand.some(card => card.id === 'mococo'), true);
  assert.deepEqual(s.pendingChoice.options, ['center']);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 20);
});

test('hBP08-092 skips special damage when own Life is not lower', () => {
  const fuwawa = cardNamed('フワワ・アビスガード', card => card.stage === 'Debut');
  const mococo = cardNamed('モココ・アビスガード', card => card.stage === 'Debut');
  let s = state();
  s.players[0].mainDeck = [inst(fuwawa.number, 'fuwawa'), inst(mococo.number, 'mococo')];
  s = support(s, 'hBP08-092');
  s = resolveSearchPair(s, 'fuwawa', 'mococo');
  assert.equal(s.pendingChoice, null);
  assert.equal(s.players[1].zones.center.damage, 0);
});

test('hBP08-093 requires all own Holomen to be Choco and Life at most three', () => {
  const choco = cardNamed('癒月ちょこ', card => card.stage === 'Debut');
  assert.ok(choco);
  let s = state(choco.number);
  s.players[0].life = s.players[0].life.slice(0, 3);
  const otherHolomen = cards.find(card => card.group === 'holomem' && !card.jpName?.includes('癒月ちょこ'));
  assert.ok(otherHolomen);
  s.players[0].zones.back1 = unit(otherHolomen.number);
  s.players[0].hand = [inst('hBP08-093', 'choco-support')];
  assert.throws(() => applyAction(s, 0, { type: 'play', cardId: 'choco-support' }, pool, () => 0));
  assert.equal(s.players[0].hand[0].id, 'choco-support');
  s.players[0].zones.back1 = unit(choco.number);
  s.players[0].life = s.players[0].life.slice(0, 4);
  assert.throws(() => applyAction(s, 0, { type: 'play', cardId: 'choco-support' }, pool, () => 0));
});

test('hBP08-093 gives +20 to Debut/1st and +60 to 2nd while Life is three', () => {
  const chocoDebut = cardNamed('癒月ちょこ', card => card.stage === 'Debut');
  const chocoFirst = cardNamed('癒月ちょこ', card => card.stage === '1st');
  const chocoSecond = cardNamed('癒月ちょこ', card => card.stage === '2nd');
  assert.ok(chocoDebut && chocoFirst && chocoSecond);
  let s = state(chocoDebut.number);
  s.players[0].life = s.players[0].life.slice(0, 3);
  s.players[0].zones.back1 = unit(chocoFirst.number);
  s.players[0].zones.back2 = unit(chocoSecond.number);
  s = support(s, 'hBP08-093');
  assert.deepEqual(s.players[0].modifiers.map(modifier => [modifier.amount, modifier.rule.stages]), [[20, ['Debut', '1st']], [60, ['2nd']]]);
});

test('hBP08-094 requires own Collab and reduces the first incoming Arts only', () => {
  let s = state();
  s.players[0].zones.collab = unit('hBP08-084');
  s = support(s, 'hBP08-094');
  assert.deepEqual(s.players[0].zones.center.modifiers.map(modifier => ({ kind: modifier.kind, amount: modifier.amount, uses: modifier.uses, opponentTurnOnly: modifier.opponentTurnOnly })), [{ kind: 'artsDamageReduction', amount: 300, uses: 1, opponentTurnOnly: true }]);

  s.activePlayer = 1;
  s.turn += 1;
  s.phase = 'performance';
  s.players[1].zones.collab = unit(dummy.number);
  s = applyAction(s, 1, attack, pool, () => 0);
  assert.equal(s.players[0].zones.center.damage, 0);
  assert.equal(s.players[0].zones.center.modifiers.some(modifier => modifier.kind === 'artsDamageReduction'), false);
  s = applyAction(s, 1, { ...attack, sourceZone: 'collab' }, pool, () => 0);
  assert.equal(s.players[0].zones.center.damage, 100);
});

test('hBP08-094 cannot be used without an own Collab Holomen', () => {
  const s = state();
  s.phase = 'main';
  s.players[0].hand = [inst('hBP08-094', 'shield-support')];
  assert.throws(() => applyAction(s, 0, { type: 'play', cardId: 'shield-support' }, pool, () => 0), /合作/u);
  assert.equal(s.players[0].hand[0].id, 'shield-support');
});

test('hBP08-095 hits both sides Center and Collab for special damage without Life loss', () => {
  const enDebut = cards.find(card => card.group === 'holomem' && card.stage === 'Debut' && card.tags.includes('#EN'));
  assert.ok(enDebut);
  let s = state(enDebut.number);
  s.players[0].life = s.players[0].life.slice(0, 3);
  s.players[0].zones.collab = unit(enDebut.number);
  s.players[1].zones.collab = unit(dummy.number);
  s = support(s, 'hBP08-095');
  assert.equal(s.players[0].zones.center.damage, 50);
  assert.equal(s.players[0].zones.collab.damage, 50);
  assert.equal(s.players[1].zones.center.damage, 50);
  assert.equal(s.players[1].zones.collab.damage, 50);
  assert.equal(s.players[0].life.length, 3);
  assert.equal(s.players[1].life.length, 5);
});

test('hBP08-095 cannot be used when an own stage Holomen lacks #EN', () => {
  const enDebut = cards.find(card => card.group === 'holomem' && card.stage === 'Debut' && card.tags.includes('#EN'));
  let s = state(enDebut.number);
  s.phase = 'main';
  s.players[0].life = s.players[0].life.slice(0, 3);
  s.players[0].zones.back1 = unit(dummy.number);
  s.players[0].hand = [inst('hBP08-095', 'spell-support')];
  assert.throws(() => applyAction(s, 0, { type: 'play', cardId: 'spell-support' }, pool, () => 0), /#EN/u);
});

test('hBP08-095 special damage does not take Life when it knocks out a front Holomen', () => {
  const enDebut = cards.find(card => card.group === 'holomem' && card.stage === 'Debut' && card.tags.includes('#EN'));
  const lowHp = cards.find(card => card.group === 'holomem' && card.hp <= 100);
  assert.ok(enDebut && lowHp);
  let s = state(enDebut.number);
  s.players[0].life = s.players[0].life.slice(0, 3);
  s.players[1].zones.center = unit(lowHp.number, { damage: Number(lowHp.hp) - 10 });
  const opponentLife = s.players[1].life.length;
  s = support(s, 'hBP08-095');
  assert.equal(s.players[1].life.length, opponentLife);
  assert.equal(s.players[1].zones.center, null);
  assert.equal(s.players[1].archive.some(card => card.number === lowHp.number), true);
});

test('hBP08-096 requires Ririka Oshi, searches Ririka and Limit Rice, then buffs all Ririka at archive threshold', () => {
  const ririkaOshi = cardNamed('一条莉々華', card => card.group === 'oshi');
  const ririka = cardNamed('一条莉々華', card => card.group === 'holomem');
  const rice = cardNamed('限界飯', card => card.group === 'support');
  const other = cards.find(card => card.group === 'holomem' && !card.jpName?.includes('一条莉々華'));
  assert.ok(ririkaOshi && ririka && rice && other);
  let s = state(ririka.number);
  s.players[0].oshi = inst(ririkaOshi.number);
  s.players[0].zones.back1 = unit(ririka.number);
  s.players[0].zones.back2 = unit(other.number);
  s.players[0].archive = Array.from({ length: 3 }, (_, i) => inst(rice.number, `arch-rice-${i}`));
  s.players[0].mainDeck = [inst(ririka.number, 'search-ririka'), inst(rice.number, 'search-rice')];
  s = support(s, 'hBP08-096');
  assert.equal(s.pendingChoice.effect, 'gentleMonsterRirika');
  s = resolveSearchPair(s, 'search-ririka', 'search-rice');
  assert.equal(s.players[0].hand.some(card => card.id === 'search-ririka'), true);
  assert.equal(s.players[0].hand.some(card => card.id === 'search-rice'), true);
  assert.equal(s.players[0].modifiers.some(modifier => modifier.amount === 50 && modifier.rule.names.includes('一条莉々華')), true);
});

test('hBP08-096 does not grant Arts bonus with fewer than three archived Limit Rice', () => {
  const ririkaOshi = cardNamed('一条莉々華', card => card.group === 'oshi');
  const ririka = cardNamed('一条莉々華', card => card.group === 'holomem');
  const rice = cardNamed('限界飯', card => card.group === 'support');
  let s = state(ririka.number);
  s.players[0].oshi = inst(ririkaOshi.number);
  s.players[0].archive = [inst(rice.number, 'arch-1'), inst(rice.number, 'arch-2')];
  s.players[0].mainDeck = [inst(ririka.number, 'search-ririka'), inst(rice.number, 'search-rice')];
  s = support(s, 'hBP08-096');
  s = resolveSearchPair(s, 'search-ririka', 'search-rice');
  assert.equal(s.players[0].modifiers.some(modifier => modifier.amount === 50), false);
});

test('hBP08-096 cannot be used with a different Oshi', () => {
  const otherOshi = cards.find(card => card.group === 'oshi' && !card.jpName?.includes('一条莉々華'));
  let s = state();
  s.phase = 'main';
  s.players[0].oshi = inst(otherOshi.number);
  s.players[0].hand = [inst('hBP08-096', 'wrong-oshi-support')];
  assert.throws(() => applyAction(s, 0, { type: 'play', cardId: 'wrong-oshi-support' }, pool, () => 0), /推し/u);
  assert.equal(s.players[0].hand[0].id, 'wrong-oshi-support');
});
