import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, conserve } from './hbp09-fixtures.mjs';

test('Q722: Blooming from Kaela-044 to Kaela-043 archives exactly one of the two Tools', () => {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'main';
  const kaela = unit('hBP09-044');
  const shield = instance('hBP09-106');
  const sword = instance('hBP09-107');
  kaela.attachments.push(shield, sword);
  state.players[0].zones.back1 = kaela;
  const bloom = instance('hBP09-043');
  state.players[0].hand.push(bloom);

  let result = act(state, { type: 'play', cardId: bloom.id });
  assert.equal(result.pendingChoice?.type, 'bloom');
  result = act(result, { type: 'choose', zone: 'back1' });

  assert.equal(result.pendingChoice?.type, 'stageAttachmentSelection', 'the controller chooses which excess Tool to archive');
  assert.equal(result.pendingChoice?.effect, 'archiveExcessAttachment');
  assert.deepEqual(new Set(result.pendingChoice.options), new Set([shield.id, sword.id]));
  result = act(result, { type: 'choose', attachmentId: shield.id });

  assert.equal(result.players[0].zones.back1.attachments.filter(card => ['supportTool'].includes(cards.find(item => item.number === card.number)?.typeCode)).length, 1);
  assert.ok(result.players[0].archive.some(card => card.id === shield.id));
  assert.ok(result.players[0].zones.back1.attachments.some(card => card.id === sword.id));
  assert.equal(result.pendingChoice, null);
  conserve(state, result);
});

test('Q723: Kaela-044 cannot accept a non-Arms Tool as its additional Tool', () => {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'main';
  const kaela = unit('hBP09-044');
  const arms = instance('hBP09-107');
  kaela.attachments.push(arms);
  state.players[0].zones.back1 = kaela;
  const nonArms = instance('hBP09-108');
  state.players[0].hand.push(nonArms);
  assert.equal(cards.find(item => item.number === nonArms.number)?.typeCode, 'supportTool');
  assert.equal(cards.find(item => item.number === nonArms.number)?.tags?.includes("#カエラ'sアームズ"), false);

  let result = act(state, { type: 'play', cardId: nonArms.id });
  assert.equal(result.pendingChoice?.type, 'attachSupport');
  assert.ok(result.pendingChoice.options.includes('center'), 'the Tool remains playable on a different eligible Holomem');
  assert.ok(!result.pendingChoice.options.includes('back1'), 'Q723 forbids Kaela-044 as the second Tool target');
  result = act(result, { type: 'choose', zone: 'center' });
  assert.ok(result.players[0].zones.center.attachments.some(card => card.id === nonArms.id));
  assert.deepEqual(result.players[0].zones.back1.attachments.map(card => card.id), [arms.id]);
  conserve(state, result);
});

test('Kaela-044 accepts an Arms Tool as its extra Tool when a non-Arms Tool is already attached', () => {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'main';
  const kaela = unit('hBP09-044');
  const existing = instance('hBP09-108');
  kaela.attachments.push(existing);
  state.players[0].zones.back1 = kaela;
  const arms = instance('hBP09-106');
  state.players[0].hand.push(arms);

  let result = act(state, { type: 'play', cardId: arms.id });
  assert.equal(result.pendingChoice?.type, 'attachSupport');
  assert.ok(result.pendingChoice.options.includes('back1'));
  result = act(result, { type: 'choose', zone: 'back1' });
  assert.deepEqual(new Set(result.players[0].zones.back1.attachments.map(card => card.id)), new Set([existing.id, arms.id]));
  conserve(state, result);
});
