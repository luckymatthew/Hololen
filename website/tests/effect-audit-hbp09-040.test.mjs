import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, answer, conserve } from './hbp09-fixtures.mjs';

const matchingTools = ['hBP09-106', 'hBP09-107'];

function kaelaFixture({ archive = matchingTools, opponentArchive = [] } = {}) {
  const state = fixture(6, 64);
  state.players[0].zones.back1 = unit('hBP09-040');
  state.players[0].archive = archive.map(instance);
  state.players[1].archive = opponentArchive.map(instance);
  return state;
}

function collab(state) {
  return act(state, { type: 'collab', zone: 'back1' });
}

test('hBP09-040 official identity and Japanese Collab text match the current catalog', () => {
  const card = cards.find(entry => entry.number === 'hBP09-040');
  assert.ok(card);
  assert.equal(card.jpName, 'カエラ・コヴァルスキア');
  assert.equal(card.stage, '1st');
  assert.equal(card.hp, 180);
  assert.equal(card.keyword.type, 'collab');
  assert.equal(card.keyword.name, 'クレーバーな仕事人');
  assert.equal(card.keyword.effect, "自分のアーカイブの#カエラ'sアームズを持つツール1枚を手札に戻せる。");
  assert.equal(card.arts[0].damage, 40);
});

test('hBP09-040 vanilla Arts pays red, rests Kaela, deals 40, and retains paid Cheer', () => {
  const state = fixture(6, 64);
  state.phase = 'performance';
  state.players[0].zones.center = unit('hBP09-040');
  state.players[0].zones.center.cheer = [instance('hY03-017')];
  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  assert.equal(result.players[1].zones.center.damage, 40);
  assert.equal(result.players[0].zones.center.rested, true);
  assert.deepEqual(result.players[0].zones.center.cheer.map(card => card.number), ['hY03-017']);
});

test('Clever Worker may return exactly one own archived Kaela Arms Tool', () => {
  const initial = kaelaFixture();
  const before = structuredClone(initial);
  const result = collab(initial);
  const choice = result.pendingChoice;

  assert.equal(choice?.type, 'cardSelection');
  assert.equal(choice?.playerIndex, 0);
  assert.equal(choice?.min, 1);
  assert.equal(choice?.max, 1);
  assert.equal(choice?.optional, true, 'the Japanese text says the Tool may be returned');
  assert.deepEqual(new Set(choice.cards.map(card => card.number)), new Set(matchingTools));

  const selected = choice.cards[0];
  const complete = answer(result, { cardIds: [selected.id] });
  assert.equal(complete.pendingChoice, null);
  assert.ok(complete.players[0].hand.some(card => card.id === selected.id));
  assert.ok(complete.players[0].archive.some(card => card.number === matchingTools.find(number => number !== selected.number)));
  assert.equal(complete.players[0].archive.some(card => card.id === selected.id), false);
  assert.equal(complete.players[0].holoPower.length, before.players[0].holoPower.length + 1, 'ordinary Collab still moves its Main Deck card to Holo Power');
  conserve(before, complete);
});

test('Clever Worker can be declined while a matching Tool is available', () => {
  const initial = kaelaFixture();
  const before = structuredClone(initial);
  const prompted = collab(initial);
  const result = answer(prompted, { skip: true });

  assert.equal(result.pendingChoice, null);
  assert.deepEqual(result.players[0].hand, before.players[0].hand);
  assert.deepEqual(result.players[0].archive, before.players[0].archive);
  assert.equal(result.players[0].holoPower.length, before.players[0].holoPower.length + 1);
  conserve(before, result);
});

test('the recovery filter excludes untagged Tools, other Supports, and an opponent archived Tool', () => {
  const state = kaelaFixture({ archive: ['hBP09-108', 'hBP09-111'], opponentArchive: ['hBP09-106'] });
  const result = collab(state);

  assert.equal(result.pendingChoice, null);
  assert.deepEqual(result.players[0].archive.map(card => card.number), ['hBP09-108', 'hBP09-111']);
  assert.deepEqual(result.players[1].archive.map(card => card.number), ['hBP09-106']);
});

test('the recovery effect creates no choice when the owner has no matching archived Tool', () => {
  for (const archive of [[], ['hBP09-108']]) {
    const state = kaelaFixture({ archive });
    const handIds = state.players[0].hand.map(card => card.id);
    const result = collab(state);

    assert.equal(result.pendingChoice, null);
    assert.deepEqual(result.players[0].hand.map(card => card.id), handIds);
    assert.deepEqual(result.players[0].archive.map(card => card.number), archive);
    assert.equal(result.players[0].holoPower.length, state.players[0].holoPower.length + 1);
  }
});

test('a stale or nonselectable archive ID is rejected without changing the pending choice state', () => {
  const prompted = collab(kaelaFixture());
  const before = structuredClone(prompted);
  assert.throws(() => answer(prompted, { cardIds: ['not-an-eligible-card'] }), /選擇|card|choice|target|invalid/iu);
  assert.deepEqual(prompted, before);
});
