import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, answer, conserve } from './hbp09-fixtures.mjs';

const arms = ['hBP09-106', 'hBP09-107'];
const cheer = 'hY01-015';

function collabFixture({ ownTools = ['hBP09-106', 'hBP09-107'], opponentTools = [], archive = [cheer, 'hBP09-108'] } = {}) {
  const state = fixture();
  const player = state.players[0];
  player.zones.center = unit('hBP09-042');
  player.zones.center.attachments = ownTools.slice(0, 1).map(instance);
  player.zones.back1 = unit('hBP09-043');
  player.zones.back1.attachments = ownTools.slice(1).map(instance);
  player.archive = archive.map(instance);
  state.players[1].zones.center.attachments = opponentTools.map(instance);
  return state;
}

function attackFixture({ target = 'hBP03-064', collab = 'hBP09-040' } = {}) {
  const state = fixture();
  state.phase = 'performance';
  state.players[0].zones.center = unit('hBP09-043');
  state.players[0].zones.center.cheer = [instance('hY03-017')];
  state.players[1].zones.center = unit(target);
  state.players[1].zones.collab = collab ? unit(collab) : null;
  state.players[1].zones.back1 = unit('hBP09-041');
  return state;
}

test('hBP09-043 official identity and printed Japanese Collab/Arts text match the current catalog', () => {
  const card = cards.find(entry => entry.number === 'hBP09-043');
  assert.ok(card);
  assert.equal(card.jpName, 'カエラ・コヴァルスキア');
  assert.equal(card.stage, '2nd');
  assert.equal(card.hp, 200);
  assert.equal(card.keyword.type, 'collab');
  assert.equal(card.keyword.name, 'Happy Summer Days');
  assert.equal(card.keyword.effect, "自分のステージに#カエラ'sアームズを持つツールが2枚以上あるなら、自分のアーカイブのエール1枚を自分のホロメンに送る。");
  assert.equal(card.arts[0].damage, 60);
  assert.deepEqual(card.arts[0].cost, ['紅']);
  assert.deepEqual(card.arts[0].specialTargets, ['黃']);
  assert.deepEqual(card.arts[0].specialValues, [50]);
  assert.equal(card.arts[0].effect, '相手のコラボホロメンに特殊ダメージ30を与える。');
});

test('Happy Summer Days counts two own-stage Kaela Arms Tools, transfers one archived Cheer to an own Holomem, and preserves Collab income', () => {
  const initial = collabFixture();
  const before = structuredClone(initial);
  let result = act(initial, { type: 'collab', zone: 'back1' });
  assert.equal(result.players[0].zones.collab.stack.at(-1).number, 'hBP09-043');
  assert.equal(result.pendingChoice?.type, 'cardSelection');
  assert.equal(result.pendingChoice?.min, 1);
  assert.equal(result.pendingChoice?.max, 1);
  assert.equal(result.pendingChoice?.optional, false);
  assert.deepEqual(result.pendingChoice.cards.map(card => card.number), [cheer]);

  const archivedCheer = result.pendingChoice.cards[0];
  result = answer(result, { cardIds: [archivedCheer.id] });
  assert.equal(result.pendingChoice?.type, 'stageTarget');
  assert.equal(result.pendingChoice.playerIndex, 0);
  assert.ok(result.pendingChoice.options.includes('center'));
  assert.ok(!result.pendingChoice.options.includes(undefined));
  result = answer(result, { zone: 'center' });

  assert.equal(result.pendingChoice, null);
  assert.ok(result.players[0].zones.center.cheer.some(card => card.id === archivedCheer.id));
  assert.ok(!result.players[0].archive.some(card => card.id === archivedCheer.id));
  assert.ok(result.players[0].zones.collab.attachments.some(card => card.number === 'hBP09-107'));
  assert.equal(result.players[0].holoPower.length, before.players[0].holoPower.length + 1, 'ordinary Collab still moves the top Main Deck card to Holo Power');
  conserve(before, result);
});

test('one own Kaela Arms Tool plus an opponent Kaela Arms Tool does not meet the two-own-Tool condition', () => {
  const state = collabFixture({ ownTools: ['hBP09-106'], opponentTools: ['hBP09-107'] });
  const archiveIds = state.players[0].archive.map(card => card.id);
  const result = act(state, { type: 'collab', zone: 'back1' });
  assert.equal(result.pendingChoice, null);
  assert.deepEqual(result.players[0].archive.map(card => card.id), archiveIds);
  assert.equal(result.players[0].zones.center.cheer.length, 0);
  assert.equal(result.players[0].holoPower.length, state.players[0].holoPower.length + 1);
});

test('a tagged Tool plus an untagged Tool is still below two matching own-stage Tools', () => {
  const state = collabFixture({ ownTools: ['hBP09-106', 'hBP09-108'] });
  assert.ok(cards.find(card => card.number === 'hBP09-108').typeCode === 'supportTool');
  assert.equal(cards.find(card => card.number === 'hBP09-108').tags.includes("#カエラ'sアームズ"), false);
  const result = act(state, { type: 'collab', zone: 'back1' });
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].archive.some(card => card.number === cheer), true);
});

test('no archived Cheer means the conditional Collab Effect opens no impossible choice', () => {
  const state = collabFixture({ archive: ['hBP09-108'] });
  const handIds = state.players[0].hand.map(card => card.id);
  const result = act(state, { type: 'collab', zone: 'back1' });
  assert.equal(result.pendingChoice, null);
  assert.deepEqual(result.players[0].hand.map(card => card.id), handIds);
  assert.deepEqual(result.players[0].archive.map(card => card.number), ['hBP09-108']);
});

test('Vacation on Islands adds 50 only against a Yellow Arts target and separately deals 30 Special damage to opposing Collab', () => {
  const state = attackFixture();
  state.players[1].zones.collab.damage = 20;
  const before = structuredClone(state);
  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  assert.equal(result.players[1].zones.center.damage, 110, '60 base Arts plus the printed Yellow +50');
  assert.equal(result.players[1].zones.collab.damage, 50, 'the separate 30 Special damage applies only to opposing Collab');
  assert.equal(result.players[1].zones.back1.damage, 0, 'the Art text does not damage another opposing position');
  assert.equal(result.players[0].zones.center.rested, true);
  assert.deepEqual(result.players[0].zones.center.cheer.map(card => card.number), ['hY03-017']);
  conserve(before, result);
});

test('the Collab Special damage resolves when the selected Arts target is different and is skipped when opponent has no Collab', () => {
  const split = act(attackFixture({ target: 'hBP09-041' }), { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  assert.equal(split.players[1].zones.center.damage, 60);
  assert.equal(split.players[1].zones.collab.damage, 30);

  const noCollab = act(attackFixture({ target: 'hBP09-041', collab: null }), { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  assert.equal(noCollab.pendingChoice, null);
  assert.equal(noCollab.players[1].zones.center.damage, 60);
  assert.equal(noCollab.players[0].zones.center.rested, true);
});

test('Special damage and the Yellow Arts hit remain in one Arts resolution and cause one final Down', () => {
  const state = attackFixture({ target: 'hBP03-064', collab: 'hBP03-064' });
  state.players[1].zones.collab.damage = 20;
  const before = structuredClone(state);
  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'collab' });
  assert.equal(result.players[1].zones.collab, null, '20 existing + 30 Special + 110 Yellow Arts damage Downs the declared Collab target');
  assert.equal(result.knockouts.length, 1, 'the same Holomem is not Downed once for each damage event');
  assert.equal(result.knockouts[0].cardNumber, 'hBP03-064');
  assert.equal(result.knockouts[0].byArts, true, 'the Down is committed at the enclosing Arts-resolution boundary');
  assert.equal(result.lifeLosses.filter(loss => loss.ownerIndex === 1).length, 1);
  assert.equal(result.players[1].life.length, before.players[1].life.length - 1);
  assert.ok(result.pendingChoice, 'the Down Life card still enters its normal Cheer destination choice');
  const settled = answer(result, { zone: 'center' });
  assert.equal(settled.pendingChoice, null);
  conserve(before, settled);
});
