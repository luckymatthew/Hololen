import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, isActionCandidateLegal } from '../lib/simulator/engine.mjs';
import { cards, pool, dummy, inst, unit, state, fund, attack } from './fixtures/simulator-audit.mjs';

const support = (s, number, id = `support-${number}`) => {
  s.phase = 'main';
  s.players[0].hand.push(inst(number, id));
  return applyAction(s, 0, { type: 'play', cardId: id }, pool, () => 0);
};
const findHolomem = predicate => cards.find(card => card.group === 'holomem' && predicate(card));

test('hBP08-097 heals 20 and only offers Archive Cheer once two #食物 events are archived', () => {
  const cheer = cards.find(card => card.group === 'cheer');
  assert.ok(cheer);
  let s = state();
  s.players[0].zones.center.damage = 50;
  s.players[0].archive = [inst(cheer.number, 'cheer')];
  s = support(s, 'hBP08-097', 'hamburg');
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.players[0].zones.center.damage, 30);
  assert.equal(s.pendingChoice, null, 'the just-used event itself is only the first archived #食物 card');

  s = state();
  s.players[0].zones.center.damage = 50;
  s.players[0].archive = [inst('hBP08-097', 'archived-food'), inst(cheer.number, 'cheer')];
  s = support(s, 'hBP08-097', 'hamburg');
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.players[0].zones.center.damage, 30);
  assert.equal(s.pendingChoice.optional, false);
  s = applyAction(s, 0, { type: 'choose', cardIds: ['cheer'] }, pool, () => 0);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.equal(s.players[0].zones.center.cheer.some(card => card.id === 'cheer'), true);
});

test('hBP08-098 requires every own stage Holomen to have #Myth', () => {
  const myth = findHolomem(card => card.tags.includes('#Myth'));
  assert.ok(myth);
  let s = state(myth.number);
  s.phase = 'main';
  s.players[0].hand = [inst('hBP08-098', 'mythology')];
  s.players[0].mainDeck = Array.from({ length: 4 }, (_, i) => inst(dummy.number, `top-${i}`));
  s = applyAction(s, 0, { type: 'play', cardId: 'mythology' }, pool, () => 0);
  assert.equal(s.pendingChoice.effect, 'mythologyPick');
  assert.equal(s.pendingChoice.min, 2);
  assert.equal(s.pendingChoice.max, 2);
  s = applyAction(s, 0, { type: 'choose', cardIds: ['top-0', 'top-2'] }, pool, () => 0);
  assert.deepEqual(s.players[0].hand.map(card => card.id), ['top-0', 'top-2']);
  assert.deepEqual(s.players[0].archive.map(card => card.id), ['mythology', 'top-1', 'top-3']);
});

test('hBP08-098 rejects use if any own stage Holomen lacks #Myth', () => {
  const myth = findHolomem(card => card.tags.includes('#Myth'));
  assert.ok(myth);
  let s = state(myth.number);
  s.phase = 'main';
  s.players[0].zones.back1 = unit(dummy.number);
  s.players[0].hand = [inst('hBP08-098', 'mythology')];
  assert.throws(() => applyAction(s, 0, { type: 'play', cardId: 'mythology' }, pool, () => 0), /#Myth/u);
});

test('hBP08-100 reveals four, admits any number of #Myth Holomen, and bottoms the rest in chosen order', () => {
  const myth = findHolomem(card => card.tags.includes('#Myth'));
  const nonMyth = findHolomem(card => !card.tags.includes('#Myth'));
  assert.ok(myth && nonMyth);
  let s = state();
  s.players[0].mainDeck = [inst(myth.number, 'myth-1'), inst(nonMyth.number, 'other-1'), inst(myth.number, 'myth-2'), inst(nonMyth.number, 'other-2')];
  s = support(s, 'hBP08-100');
  assert.equal(s.pendingChoice.effect, 'topLookToHand');
  assert.deepEqual(new Set(s.pendingChoice.selectableIds), new Set(['myth-1', 'myth-2']));
  s = applyAction(s, 0, { type: 'choose', cardIds: ['myth-1'] }, pool, () => 0);
  assert.equal(s.pendingChoice.effect, 'bottomOrder');
  s = applyAction(s, 0, { type: 'choose', cardIds: ['other-2', 'other-1', 'myth-2'] }, pool, () => 0);
  assert.equal(s.players[0].hand.some(card => card.id === 'myth-1'), true);
  assert.deepEqual(s.players[0].mainDeck.slice(-3).map(card => card.id), ['other-2', 'other-1', 'myth-2']);
});

test('hBP08-100 hand limit counts other cards and allows six but rejects seven', () => {
  for (const [otherCards, allowed] of [[6, true], [7, false]]) {
    let s = state();
    s.players[0].hand = Array.from({ length: otherCards }, (_, i) => inst(dummy.number, `hand-${i}`));
    s.players[0].mainDeck = [inst(dummy.number, 'top')];
    s.players[0].hand.push(inst('hBP08-100', 'myth-support'));
    s.phase = 'main';
    if (allowed) {
      s = applyAction(s, 0, { type: 'play', cardId: 'myth-support' }, pool, () => 0);
      assert.equal(s.players[0].mainDeck.length, 0);
    } else assert.throws(() => applyAction(s, 0, { type: 'play', cardId: 'myth-support' }, pool, () => 0), /手牌不可多於 6/u);
  }
});

test('hBP08-099 draw mode archives one #トリ Cheer, draws two, then bottoms one hand card', () => {
  const bird = findHolomem(card => card.tags.includes('#トリ'));
  assert.ok(bird);
  let s = state(bird.number);
  s.phase = 'main';
  s.players[0].zones.center.cheer = [inst('hY01-001', 'spent-cheer')];
  s.players[0].hand = [inst('hBP08-099', 'holotori'), inst(dummy.number, 'spare')];
  s.players[0].mainDeck = [inst(dummy.number, 'draw-1'), inst(dummy.number, 'draw-2')];
  s = applyAction(s, 0, { type: 'play', cardId: 'holotori' }, pool, () => 0);
  assert.deepEqual(s.pendingChoice.modeOptions.map(option => option.id), ['draw']);
  s = applyAction(s, 0, { type: 'choose', optionId: 'draw' }, pool, () => 0);
  assert.equal(s.pendingChoice.effect, 'holotoriDrawCost');
  s = applyAction(s, 0, { type: 'choose', cheerId: 'spent-cheer' }, pool, () => 0);
  assert.deepEqual(s.players[0].hand.map(card => card.id), ['spare', 'draw-1', 'draw-2']);
  assert.equal(s.pendingChoice.effect, 'handToBottom');
  s = applyAction(s, 0, { type: 'choose', cardIds: ['draw-1'] }, pool, () => 0);
  assert.equal(s.players[0].archive.some(card => card.id === 'spent-cheer'), true);
  assert.equal(s.players[0].mainDeck.at(-1).id, 'draw-1');
  assert.deepEqual(s.players[0].hand.map(card => card.id), ['spare', 'draw-2']);
});

test('hBP08-101 searches two #ReGLOSS Holomen, then draws and archives one card only when behind on stage count', () => {
  const regloss = findHolomem(card => card.tags.includes('#ReGLOSS'));
  assert.ok(regloss);
  let s = state(regloss.number);
  s.players[1].zones.collab = unit(dummy.number);
  s.players[0].mainDeck = [inst(regloss.number, 'search-1'), inst(regloss.number, 'search-2'), inst(dummy.number, 'drawn')];
  s = support(s, 'hBP08-101');
  assert.equal(s.pendingChoice.min, 0, 'hidden-deck search supports the established fail-to-find option');
  assert.equal(s.pendingChoice.nonEmptyMin, 2, 'if cards are selected, the text requires exactly two');
  assert.equal(s.pendingChoice.max, 2);
  s = applyAction(s, 0, { type: 'choose', cardIds: ['search-1', 'search-2'] }, pool, () => 0);
  assert.equal(s.players[0].hand.some(card => card.id === 'drawn'), true);
  assert.equal(s.pendingChoice.effect, 'handToArchive');
  s = applyAction(s, 0, { type: 'choose', cardIds: ['drawn'] }, pool, () => 0);
  assert.equal(s.players[0].archive.some(card => card.id === 'drawn'), true);
});

test('hBP08-101 skips its draw/discard when own and opposing stage counts are equal', () => {
  const regloss = findHolomem(card => card.tags.includes('#ReGLOSS'));
  assert.ok(regloss);
  let s = state(regloss.number);
  s.players[0].zones.back1 = unit(regloss.number);
  s.players[1].zones.collab = unit(dummy.number);
  s.players[0].mainDeck = [inst(regloss.number, 'search-1'), inst(regloss.number, 'search-2'), inst(dummy.number, 'drawn')];
  s = support(s, 'hBP08-101');
  s = applyAction(s, 0, { type: 'choose', cardIds: ['search-1', 'search-2'] }, pool, () => 0);
  assert.equal(s.players[0].hand.length, 2);
  assert.equal(s.pendingChoice, null);
});

test('hBP08-101 preserves the local hidden-deck fail-to-find behavior', () => {
  const regloss = findHolomem(card => card.tags.includes('#ReGLOSS'));
  assert.ok(regloss);
  let s = state(regloss.number);
  s.players[0].mainDeck = [inst(regloss.number, 'search-1'), inst(regloss.number, 'search-2')];
  s = support(s, 'hBP08-101');
  assert.equal(s.pendingChoice.min, 0);
  assert.equal(s.pendingChoice.nonEmptyMin, 2);
  assert.equal(s.pendingChoice.optional, false);
  s = applyAction(s, 0, { type: 'choose', cardIds: [] }, pool, () => 0);
  assert.equal(s.players[0].hand.length, 0);
  assert.equal(s.pendingChoice, null);
});

test('hBP08-102 provides its printed Arts +10 when attached to a Buzz Holomen', () => {
  const buzz = findHolomem(card => card.typeCode === 'buzzCharacter' && card.arts?.[0]?.effect === '');
  assert.ok(buzz);
  let s = state(buzz.number);
  s.players[0].zones.center.attachments = [inst('hBP08-102', 'hoodie')];
  fund(s.players[0].zones.center, buzz.arts[0].cost);
  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.players[1].zones.center.damage, buzz.arts[0].damage + 10);
});

test('hBP08-102 draws two when its equipped Buzz knocks out an opposing Holomen', () => {
  const buzz = findHolomem(card => card.typeCode === 'buzzCharacter');
  const target = cards.find(card => card.group === 'holomem' && card.hp <= 100);
  assert.ok(buzz && target);
  let s = state(buzz.number);
  s.players[0].zones.center.attachments = [inst('hBP08-102', 'hoodie')];
  fund(s.players[0].zones.center, buzz.arts[0].cost);
  s.players[1].zones.center = unit(target.number, { damage: Number(target.hp) - buzz.arts[0].damage - 1 });
  s.players[1].zones.collab = unit(dummy.number);
  s.players[0].mainDeck = Array.from({ length: 5 }, (_, i) => inst(dummy.number, `draw-${i}`));
  s = applyAction(s, 0, attack, pool, () => 0);
  assert.equal(s.players[0].hand.length, 2);
  assert.deepEqual(s.players[0].hand.map(card => card.id), ['draw-0', 'draw-1']);
});

test('hBP08-103 adds 50 HP to its equipped Holomen', () => {
  const guard = findHolomem(card => !String(card.type || '').toUpperCase().includes('BUZZ') && !/倒下/u.test(String(card.extra || '')) && Number(card.hp) >= 200);
  assert.ok(guard);
  let s = state(guard.number);
  s.players[0].zones.center.attachments = [inst('hBP08-103', 'cloak')];
  s.players[0].zones.center.damage = 140;
  s.players[1].zones.center = unit(dummy.number);
  s.activePlayer = 1;
  s.phase = 'performance';
  s = applyAction(s, 1, attack, pool, () => 0);
  assert.equal(s.players[0].zones.center.damage, 240);
  assert.equal(s.players[0].life.length, 5, 'damage above base HP but below boosted HP does not knock out the equipped Holomen');
});

test('hBP08-103 costs its owner one additional Life when equipped Holomen is knocked out', () => {
  const guard = findHolomem(card => !String(card.type || '').toUpperCase().includes('BUZZ') && !/倒下/u.test(String(card.extra || '')) && Number(card.hp) >= 200);
  assert.ok(guard);
  let s = state(guard.number);
  s.players[0].zones.center.attachments = [inst('hBP08-103', 'cloak')];
  s.players[0].zones.center.damage = Number(guard.hp) + 50 - 100;
  s.players[0].zones.back1 = unit(dummy.number);
  s.players[1].zones.center = unit(dummy.number);
  s.activePlayer = 1;
  s.phase = 'performance';
  s = applyAction(s, 1, attack, pool, () => 0);
  assert.equal(s.players[0].life.length, 4, 'Cloak resolves its extra Life before the normal knockout Life');
  let choices = 0;
  while (s.pendingChoice?.type === 'lifeCheerTarget' && choices < 3) {
    s = applyAction(s, s.pendingChoice.playerIndex, { type: 'choose', zone: 'back1' }, pool, () => 0);
    choices += 1;
  }
  assert.equal(choices, 2);
  assert.equal(s.players[0].life.length, 3, 'normal knockout costs one Life and Cloak costs one additional Life');
  assert.equal(s.players[0].zones.center, null);
});

test('hBP08-104 increases opposing Center Baton cost only while attached to a Center/Collab Suu', () => {
  let s = state('hBP08-047');
  s.players[0].zones.center.attachments = [inst('hBP08-104', 'breath')];
  s.players[1].zones.center = unit('hBP08-047');
  s.players[1].zones.back1 = unit(dummy.number);
  fund(s.players[1].zones.center, ['無色']);
  s.activePlayer = 1;
  s.phase = 'main';
  const baton = { type: 'baton', zone: 'back1' };
  assert.equal(isActionCandidateLegal(s, 1, baton, pool), false, 'one Cheer cannot pay printed cost 1 plus the Suu increase');
  fund(s.players[1].zones.center, ['無色', '無色']);
  assert.equal(isActionCandidateLegal(s, 1, baton, pool), true);
  s = applyAction(s, 1, baton, pool, () => 0);
  assert.equal(s.players[1].zones.center.stack.at(-1).number, dummy.number);
});

test('hBP08-104 attached to Suu draws one when she Blooms', () => {
  let s = state('hBP08-047');
  s.players[0].zones.center.attachments = [inst('hBP08-104', 'breath')];
  s.players[0].hand = [inst('hBP08-049', 'suu-first')];
  s.players[0].mainDeck = [inst(dummy.number, 'bloom-draw')];
  s.phase = 'main';
  s = applyAction(s, 0, { type: 'play', cardId: 'suu-first' }, pool, () => 0);
  s = applyAction(s, 0, { type: 'choose', zone: 'center' }, pool, () => 0);
  assert.deepEqual(s.players[0].hand.map(card => card.id), ['bloom-draw']);
  assert.equal(s.players[0].zones.center.attachments.some(card => card.id === 'breath'), true);
});
