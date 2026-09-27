import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act } from './hbp09-fixtures.mjs';

function kaelaFixture({ tool = null, toolZone = 'back1', nonTool = null } = {}) {
  const state = fixture(6, 64);
  const own = state.players[0];
  own.zones.back1 = unit('hBP09-038');
  if (tool) own.zones[toolZone].attachments.push(instance(tool));
  if (nonTool) own.zones.back1.attachments.push(instance(nonTool));
  return state;
}

function collabKaela(state) {
  return act(state, { type: 'collab', zone: 'back1' });
}

test('hBP09-038 official card identity and Japanese Collab/Arts text match the current catalog', () => {
  const card = cards.find(entry => entry.number === 'hBP09-038');
  assert.ok(card);
  assert.equal(card.jpName, 'カエラ・コヴァルスキア');
  assert.equal(card.stage, 'Debut');
  assert.equal(card.hp, 110);
  assert.equal(card.keyword.type, 'collab');
  assert.equal(card.keyword.name, 'Blacksmith');
  assert.equal(card.keyword.effect, 'このホロメンにツールが付いているなら、自分のデッキを1枚引く。');
  assert.equal(card.arts[0].damage, 30);
  assert.deepEqual(card.arts[0].cost, ['紅']);
});

test('Kaela draws exactly the top Main Deck card when any Tool is attached to her at Collab', () => {
  const state = kaelaFixture({ tool: 'hBP09-108' });
  const own = state.players[0];
  const collabPowerCard = own.mainDeck[0];
  const drawCard = own.mainDeck[1];
  const originalDeckSize = own.mainDeck.length;
  const originalHandSize = own.hand.length;
  const originalPowerSize = own.holoPower.length;
  const originalOpponentHandSize = state.players[1].hand.length;

  const result = collabKaela(state);

  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].mainDeck.length, originalDeckSize - 2, 'ordinary Collab puts one card into Holo Power, and Blacksmith draws one');
  assert.equal(result.players[0].hand.length, originalHandSize + 1);
  assert.equal(result.players[0].hand.at(-1).id, drawCard.id, 'the draw takes the remaining top card after the ordinary Collab Holo Power move');
  assert.equal(result.players[0].holoPower.length, originalPowerSize + 1);
  assert.equal(result.players[0].holoPower.at(-1).id, collabPowerCard.id);
  assert.equal(result.players[1].hand.length, originalOpponentHandSize);
  assert.equal(result.players[0].zones.collab.attachments.some(card => card.number === 'hBP09-108'), true);
});

test('a Tool on a different own Holomem does not satisfy “this Holomem has a Tool”', () => {
  const state = kaelaFixture({ tool: 'hBP09-106', toolZone: 'center' });
  const originalDeckSize = state.players[0].mainDeck.length;
  const originalPowerSize = state.players[0].holoPower.length;
  const handIds = state.players[0].hand.map(card => card.id);

  const result = collabKaela(state);

  assert.equal(result.players[0].mainDeck.length, originalDeckSize - 1, 'ordinary Collab takes only its Holo Power card');
  assert.equal(result.players[0].holoPower.length, originalPowerSize + 1);
  assert.equal(result.players[0].hand.map(card => card.id).join(), handIds.join());
  assert.equal(result.players[0].zones.center.attachments[0].number, 'hBP09-106');
});

test('Kaela does not draw when she has no Tool or only a legal Fan attachment', () => {
  for (const state of [kaelaFixture(), kaelaFixture({ nonTool: 'hBP09-111' })]) {
    const originalDeckSize = state.players[0].mainDeck.length;
    const originalPowerSize = state.players[0].holoPower.length;
    const handIds = state.players[0].hand.map(card => card.id);
    const result = collabKaela(state);
    assert.equal(result.players[0].mainDeck.length, originalDeckSize - 1, 'no Blacksmith draw occurs; only ordinary Collab moves a card to Holo Power');
    assert.equal(result.players[0].holoPower.length, originalPowerSize + 1);
    assert.equal(result.players[0].hand.map(card => card.id).join(), handIds.join());
  }
});

test('Blacksmith cannot draw when ordinary Collab consumes the last Main Deck card', () => {
  const state = kaelaFixture({ tool: 'hBP09-108' });
  state.players[0].mainDeck = state.players[0].mainDeck.slice(0, 1);
  const originalPowerSize = state.players[0].holoPower.length;
  const originalHandSize = state.players[0].hand.length;
  const result = collabKaela(state);
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].mainDeck.length, 0);
  assert.equal(result.players[0].hand.length, originalHandSize, 'no card is fabricated when the deck cannot satisfy the draw');
  assert.equal(result.players[0].holoPower.length, originalPowerSize + 1, 'ordinary Collab moves the last available card to Holo Power');
});

test('hBP09-038 Arts deals 30, rests Kaela, and leaves its red cost Cheer attached', () => {
  const state = fixture(6, 64);
  state.phase = 'performance';
  state.players[0].zones.collab = unit('hBP09-038', 1);
  state.players[0].zones.collab.cheer[0] = instance('hY03-017');
  const costIds = state.players[0].zones.collab.cheer.map(card => card.id);

  const result = act(state, { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' });

  assert.equal(result.players[1].zones.center.damage, 30);
  assert.equal(result.players[0].zones.collab.rested, true);
  assert.deepEqual(result.players[0].zones.collab.cheer.map(card => card.id), costIds);
});
