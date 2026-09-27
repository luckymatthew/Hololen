import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act } from './hbp09-fixtures.mjs';

let serial = 0;
function mioBloomFixture({ oshi = 'hBP07-003', deck = ['hBP09-100', 'hBP09-051', 'hBP09-064', 'hBP01-105'], hand = ['hBP09-035', 'hBP01-116', 'hBP01-122'] } = {}) {
  const state = fixture(6, 64);
  state.turn = 8; state.phase = 'main'; state.activePlayer = 0;
  const player = state.players[0];
  player.oshi = instance(oshi);
  player.turnsTaken = 3;
  player.turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  player.zones = { center: unit('hBP09-033'), collab: null, back1: unit('hBP09-032'), back2: null, back3: null, back4: null, back5: null };
  player.zones.center.enteredTurn = 1; player.zones.back1.enteredTurn = 1;
  player.mainDeck = deck.map(instance);
  player.hand = hand.map(instance);
  return state;
}

function bloom035(state) {
  const card = state.players[0].hand.find(item => item.number === 'hBP09-035');
  assert.ok(card);
  let result = act(state, { type: 'play', cardId: card.id });
  assert.equal(result.pendingChoice?.type, 'bloom');
  result = act(result, { type: 'choose', zone: 'center' });
  assert.equal(result.players[0].zones.center.stack.at(-1).number, 'hBP09-035');
  return result;
}

function artsFixture(deck = ['hBP09-100', 'hBP09-051'], targetNumber = 'hBP05-050') {
  const state = fixture(6, 64);
  state.turn = 8; state.phase = 'performance'; state.activePlayer = 0;
  const owner = state.players[0];
  owner.turnsTaken = 3;
  owner.turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  owner.zones = { center: unit('hBP09-035'), collab: null, back1: unit('hBP09-033'), back2: null, back3: null, back4: null, back5: null };
  owner.zones.center.cheer = Array.from({ length: 4 }, () => instance('hY02-001'));
  owner.mainDeck = deck.map(instance);
  state.players[1].zones = { center: unit(targetNumber), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  return state;
}

function startArts(state) {
  return act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
}

function chooseOption(state, optionId) {
  const choice = state.pendingChoice;
  assert.equal(choice?.type, 'optionChoice');
  assert.ok(choice.modeOptions.some(option => option.id === optionId));
  return act(state, { type: 'choose', optionId, option: optionId, mode: optionId }, choice.playerIndex);
}

function chooseBoostTarget(state, zone) {
  assert.equal(state.pendingChoice?.type, 'stageTarget');
  return act(state, { type: 'choose', zone }, state.pendingChoice.playerIndex);
}

test('hBP09-035 RR/SR/UR identity and official Japanese Bloom/Arts text match catalogue', () => {
  const card = cards.find(entry => entry.number === 'hBP09-035');
  assert.ok(card);
  assert.equal(card.jpName, '大神ミオ');
  assert.equal(card.stage, '2nd');
  assert.equal(card.hp, 210);
  assert.deepEqual(new Set(card.variants.map(variant => variant.rarity)), new Set(['RR', 'SR', 'UR']));
  assert.equal(card.keyword.type, 'bloom');
  assert.equal(card.keyword.name, '癒しの空間');
  assert.equal(card.keyword.effect, '自分の推しホロメンが〈大神ミオ〉なら、自分のデッキを3枚引き、手札2枚を好きな順でデッキの上に戻す。');
  assert.equal(card.arts[0].effect, '自分のデッキの上から2枚をアーカイブできる:自分のステージのホロメン1人を選ぶ。この能力でアーカイブしたサポート1枚につき、このターンの間、選んだホロメンのアーツ+30。');
  assert.deepEqual(card.arts[0].cost, ['綠', '無色', '無色', '無色']);
  assert.equal(card.arts[0].damage, 180);
  assert.deepEqual(card.arts[0].specialTargets, ['藍']);
  assert.deepEqual(card.arts[0].specialValues, [50]);
});

test('Mio-named Oshi Bloom draws three and returns any two hand cards to deck top in the chosen order', () => {
  const state = mioBloomFixture();
  const original = state.players[0];
  const initialHand = original.hand.filter(card => card.number !== 'hBP09-035');
  const drawn = original.mainDeck.slice(0, 3);
  const rest = original.mainDeck.slice(3);
  let result = bloom035(state);
  assert.equal(result.pendingChoice?.type, 'cardSelection');
  assert.equal(result.pendingChoice.min, 2);
  assert.equal(result.pendingChoice.max, 2);
  assert.equal(result.pendingChoice.optional, false);
  assert.deepEqual(new Set(result.pendingChoice.selectableIds), new Set([...initialHand, ...drawn].map(card => card.id)));
  const chosen = [drawn[1], initialHand[0]];
  result = act(result, { type: 'choose', cardIds: chosen.map(card => card.id) }, result.pendingChoice.playerIndex);
  assert.equal(result.pendingChoice, null);
  assert.deepEqual(result.players[0].mainDeck.map(card => card.id), [...chosen, ...rest].map(card => card.id));
  assert.deepEqual(new Set(result.players[0].hand.map(card => card.id)), new Set([...initialHand, ...drawn].filter(card => !chosen.some(item => item.id === card.id)).map(card => card.id)));
});

test('older Mio Oshi name activates the Bloom keyword; an unrelated Oshi leaves hand and deck alone', () => {
  let result = bloom035(mioBloomFixture({ oshi: 'hBD24-064' }));
  assert.equal(result.pendingChoice?.type, 'cardSelection', 'older Mio Oshi printing is accepted by name');
  result = bloom035(mioBloomFixture({ oshi: 'hBP01-001' }));
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].mainDeck.length, 4);
  assert.deepEqual(result.players[0].hand.map(card => card.number), ['hBP01-116', 'hBP01-122']);
});

test('when draw and hand leave only one card, the mandatory two-card deck-top return resolves as much as possible', () => {
  const state = mioBloomFixture({ deck: [], hand: ['hBP09-035', 'hBP01-105'] });
  const onlyReturnable = state.players[0].hand[1];
  let result = bloom035(state);
  assert.equal(result.pendingChoice?.type, 'cardSelection');
  assert.deepEqual(result.pendingChoice.selectableIds, [onlyReturnable.id]);
  assert.equal(result.pendingChoice.min, 1);
  assert.equal(result.pendingChoice.max, 1);
  result = act(result, { type: 'choose', cardIds: [onlyReturnable.id] }, result.pendingChoice.playerIndex);
  assert.equal(result.pendingChoice, null);
  assert.deepEqual(result.players[0].mainDeck.map(card => card.id), [onlyReturnable.id]);
  assert.equal(result.players[0].hand.length, 0);
});

test('one Support among the archived top two adds 30 before this Arts damage and stacks Blue +50', () => {
  const state = artsFixture(['hBP09-100', 'hBP09-051']);
  const topTwo = state.players[0].mainDeck.slice(0, 2);
  let result = startArts(state);
  assert.equal(result.pendingChoice?.type, 'optionChoice');
  result = chooseOption(result, 'yes');
  assert.equal(result.pendingChoice?.type, 'stageTarget');
  result = chooseBoostTarget(result, 'center');
  assert.equal(result.pendingChoice, null);
  assert.ok(topTwo.every(card => result.players[0].archive.some(current => current.id === card.id)));
  assert.ok(result.log.some(entry => JSON.stringify(entry).includes('造成 260 傷害')), '180 base +30 Support +50 Blue bonus');
  assert.equal(result.players[1].life.length, 3, '260 downs the 250 HP Buzz; its Extra resolves for -2 Life total');
  assert.equal(result.players[0].zones.center.rested, true);
  assert.equal(result.players[0].zones.center.cheer.length, 4);
});

test('two archived Supports add +60 Arts to the selected own Holomem for the current turn', () => {
  const state = artsFixture(['hBP09-100', 'hBP01-116']);
  let result = chooseOption(startArts(state), 'yes');
  result = chooseBoostTarget(result, 'back1');
  assert.ok(result.players[0].zones.back1.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 60));
  assert.ok(result.log.some(entry => JSON.stringify(entry).includes('造成 230 傷害')), 'the selected backline receives the buff, while this unselected attacker deals 180 + Blue 50');
  assert.equal(result.players[1].life.length, 5);
});

test('declining the optional Arts cost leaves the top deck intact and resolves only base plus Blue damage', () => {
  const state = artsFixture(['hBP09-100', 'hBP01-116']);
  const deckIds = state.players[0].mainDeck.map(card => card.id);
  const result = chooseOption(startArts(state), 'no');
  assert.equal(result.pendingChoice, null);
  assert.deepEqual(result.players[0].mainDeck.map(card => card.id), deckIds);
  assert.equal(result.players[0].archive.length, 0);
  assert.ok(result.log.some(entry => JSON.stringify(entry).includes('造成 230 傷害')));
});

test('one Support in the top two contributes +30; a non-Support does not count as an archived Support', () => {
  const state = artsFixture(['hBP09-051', 'hBP09-100'], 'hBP05-050');
  let result = chooseOption(startArts(state), 'yes');
  result = chooseBoostTarget(result, 'back1');
  assert.ok(result.log.some(entry => JSON.stringify(entry).includes('造成 230 傷害')), 'the attacker is not selected, so damage is 180 +50');
  assert.ok(result.players[0].zones.back1.modifiers.some(modifier => modifier.kind === 'arts' && modifier.amount === 30));
});

test('the two-card Arts cost is unavailable with zero or one main-deck card', () => {
  for (const deck of [[], ['hBP09-100']]) {
    const state = artsFixture(deck);
    const deckIds = state.players[0].mainDeck.map(card => card.id);
    const result = startArts(state);
    assert.equal(result.pendingChoice, null, `an exact two-card optional cost cannot be partially paid with ${deck.length} deck card(s)`);
    assert.deepEqual(result.players[0].mainDeck.map(card => card.id), deckIds);
    assert.equal(result.players[0].archive.length, 0);
    assert.ok(result.log.some(entry => JSON.stringify(entry).includes('造成 230 傷害')), 'the ordinary Arts and its Blue modifier still resolve');
  }
});
