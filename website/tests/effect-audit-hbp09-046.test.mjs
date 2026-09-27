import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, conserve } from './hbp09-fixtures.mjs';

const debuts = cards.filter(card => card.group === 'holomem' && card.jpName === '百鬼あやめ' && card.stage === 'Debut').map(card => card.number);

function fullStageCollabFixture() {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'main';
  state.players[0].turnsTaken = 3;
  state.players[0].turnEvents = { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  state.players[0].zones = {
    center: unit('hBP09-001'),
    collab: null,
    back1: unit('hBP09-046'),
    back2: unit('hBP09-047'),
    back3: unit('hBP09-048'),
    back4: unit('hBP09-049'),
    back5: unit('hBP09-050'),
  };
  state.players[0].cheerDeck = [instance('hY03-001'), instance('hY04-001')];
  state.players[0].mainDeck = [instance('hBP09-047'), instance(debuts.find(number => number !== 'hBP09-046')), instance('hBP09-048'), instance('hBP09-049')];
  state.players[1].zones.center = unit('hBP09-041');
  return state;
}

test('hBP09-046 official card identity and Q724 full-stage behavior are represented by the current catalog', () => {
  const card = cards.find(entry => entry.number === 'hBP09-046');
  assert.ok(card);
  assert.equal(card.jpName, '百鬼あやめ');
  assert.equal(card.stage, 'Debut');
  assert.equal(card.hp, 110);
  assert.deepEqual(card.colors, ['紅']);
  assert.deepEqual(new Set(card.variants.map(variant => variant.rarity)), new Set(['U', 'S']));
  assert.deepEqual(card.arts[0].cost, ['紅']);
  assert.equal(card.arts[0].name, '鬼の宴');
  assert.equal(card.arts[0].damage, 20);
  assert.equal(card.keyword.effect, '自分のエールデッキの上から1枚をアーカイブできる:自分のデッキから、Debut〈百鬼あやめ〉1枚をステージに出す。そしてデッキをシャッフルする。');
  assert.ok(debuts.some(number => number !== 'hBP09-046'), 'fixture contains another legal Debut Ayame to search for');
});

test('hBP09-046 Red Arts deals its printed 20 damage and keeps the paid Cheer attached', () => {
  const state = fullStageCollabFixture();
  state.phase = 'performance';
  state.players[0].zones.center = unit('hBP09-046');
  state.players[0].zones.center.cheer = [instance('hY03-001')];
  state.players[1].zones.center = unit('hBP09-041');
  const paidCheerId = state.players[0].zones.center.cheer[0].id;
  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, cards);
  assert.equal(result.players[1].zones.center.damage, 20);
  assert.equal(result.players[0].zones.center.rested, true);
  assert.deepEqual(result.players[0].zones.center.cheer.map(card => card.id), [paidCheerId]);
  assert.equal(result.pendingChoice, null);
});

test('Q724: when six Holomem already occupy the Stage, pay-top-Cheer Collab archives Cheer and shuffles without searching or deploying', () => {
  const state = fullStageCollabFixture();
  const before = structuredClone(state);
  let randomCalls = 0;
  let result = act(state, { type: 'collab', zone: 'back1' }, 0, cards, () => { randomCalls += 1; return 0.37; });
  assert.equal(result.players[0].zones.collab.stack.at(-1).number, 'hBP09-046');
  assert.equal(result.players[0].holoPower.at(-1).id, before.players[0].mainDeck[0].id, 'ordinary Collab resolves before the Collab Effect');
  assert.equal(result.pendingChoice?.type, 'optionChoice');
  const topCheer = result.players[0].cheerDeck[0];
  result = act(result, { type: 'choose', optionId: 'yes' }, result.pendingChoice.playerIndex, cards, () => { randomCalls += 1; return 0.37; });
  assert.equal(result.pendingChoice, null, 'a full Stage makes the deployment impossible, so it must not ask for a card that cannot be played');
  assert.ok(result.players[0].archive.some(card => card.id === topCheer.id), 'the optional Cheer cost was paid');
  assert.equal(result.players[0].cheerDeck.some(card => card.id === topCheer.id), false);
  assert.equal(result.players[0].mainDeck.length, before.players[0].mainDeck.length - 1, 'ordinary Collab Holo Power placement is the only Main Deck removal');
  assert.deepEqual(result.players[0].mainDeck.map(card => card.number).sort(), before.players[0].mainDeck.slice(1).map(card => card.number).sort(), 'the matching Debut stays in the Main Deck');
  assert.equal(randomCalls > 0, true, 'the printed post-search shuffle still resolves even though deployment is impossible');
  assert.equal(Object.values(result.players[0].zones).filter(Boolean).reduce((sum, holomem) => sum + holomem.stack.length, 0), 6);
  conserve(before, result);
});

test('hBP09-046 still searches and deploys one Debut Ayame when the Collab leaves legal Stage capacity', () => {
  const state = fullStageCollabFixture();
  state.players[0].zones.back5 = null;
  let randomCalls = 0;
  let result = act(state, { type: 'collab', zone: 'back1' }, 0, cards, () => { randomCalls += 1; return 0.37; });
  const topCheer = result.players[0].cheerDeck[0];
  result = act(result, { type: 'choose', optionId: 'yes' }, result.pendingChoice.playerIndex, cards, () => { randomCalls += 1; return 0.37; });
  assert.equal(result.pendingChoice?.type, 'cardSelection');
  assert.equal(result.pendingChoice.max, 1, 'available Stage capacity caps the search to one deployment');
  assert.equal(result.pendingChoice.cards.some(card => debuts.includes(card.number)), true);
  const picked = result.pendingChoice.cards.find(card => debuts.includes(card.number));
  result = act(result, { type: 'choose', cardIds: [picked.id] }, 0, cards, () => { randomCalls += 1; return 0.37; });
  assert.equal(result.pendingChoice?.type, 'stageTarget');
  result = act(result, { type: 'choose', zone: 'back1' }, 0, cards, () => { randomCalls += 1; return 0.37; });
  assert.equal(result.players[0].zones.back1.stack.at(-1).number, picked.number);
  assert.equal(result.players[0].archive.some(card => card.id === topCheer.id), true);
  assert.equal(Object.values(result.players[0].zones).filter(Boolean).reduce((sum, holomem) => sum + holomem.stack.length, 0), 6);
  assert.ok(randomCalls > 0, 'the post-search shuffle resolves after a successful deployment');
});

test('declining hBP09-046 optional Cheer payment leaves the Cheer and skips the search and shuffle', () => {
  const state = fullStageCollabFixture();
  const topCheer = state.players[0].cheerDeck[0].id;
  let randomCalls = 0;
  let result = act(state, { type: 'collab', zone: 'back1' }, 0, cards, () => { randomCalls += 1; return 0.37; });
  const deckAfterOrdinaryCollab = result.players[0].mainDeck.map(item => item.id);
  result = act(result, { type: 'choose', optionId: 'no' }, result.pendingChoice.playerIndex, cards, () => { randomCalls += 1; return 0.37; });
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].cheerDeck[0].id, topCheer);
  assert.equal(result.players[0].archive.some(item => item.id === topCheer), false);
  assert.deepEqual(result.players[0].mainDeck.map(item => item.id), deckAfterOrdinaryCollab);
  assert.equal(randomCalls, 0);
});

test('after paying hBP09-046, fail-to-find keeps a legal empty Stage slot and still shuffles the Main Deck', () => {
  const state = fullStageCollabFixture();
  state.players[0].zones.back5 = null;
  state.players[0].mainDeck = [instance('hBP09-047'), instance('hBP09-048'), instance('hBP09-049')];
  let randomCalls = 0;
  let result = act(state, { type: 'collab', zone: 'back1' }, 0, cards, () => { randomCalls += 1; return 0.37; });
  result = act(result, { type: 'choose', optionId: 'yes' }, result.pendingChoice.playerIndex, cards, () => { randomCalls += 1; return 0.37; });
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].zones.back1, null);
  assert.equal(result.players[0].cheerDeck.length, 1);
  assert.equal(result.players[0].archive.some(item => item.number === 'hY03-001' || item.number === 'hY04-001'), true);
  assert.ok(randomCalls > 0);
});
