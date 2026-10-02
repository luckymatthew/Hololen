import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act } from './hbp09-fixtures.mjs';

const card047 = cards.find(card => card.number === 'hBP09-047');
const subaruNumbers = cards.filter(card => card.group === 'holomem' && card.jpName === '大空スバル' && card.stage).map(card => card.number);

function battle({ center = 'hBP09-041', subaruZone = null, subaruUnderCard = false, opponentSubaru = false, phase = 'main' } = {}) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = phase;
  const player = state.players[0];
  player.turnsTaken = 3;
  player.turnEvents = { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  player.zones = { center: unit(center), collab: null, back1: unit('hBP09-047'), back2: null, back3: null, back4: null, back5: null };
  player.hand = [];
  player.holoPower = [];
  player.mainDeck = [instance('hBP09-046'), instance('hBP09-048'), instance('hBP09-049')];
  player.cheerDeck = [instance('hY03-001')];
  if (subaruZone) {
    const zoneCard = subaruZone === 'center' ? center : subaruUnderCard ? 'hBP09-008' : subaruNumbers[0];
    player.zones[subaruZone] = unit(zoneCard);
    if (subaruUnderCard) player.zones[subaruZone].stack.push(instance('hBP09-047'));
  }
  const opponent = state.players[1];
  opponent.zones = { center: unit(opponentSubaru ? subaruNumbers[0] : 'hBP09-041'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  return state;
}

test('hBP09-047 C/S/PR official Japanese identity, Collab text, and Arts text are represented in the catalog', () => {
  assert.ok(card047);
  assert.equal(card047.jpName, 'ハコス・ベールズ');
  assert.equal(card047.stage, 'Debut');
  assert.equal(card047.hp, 100);
  assert.deepEqual(card047.colors, ['紅']);
  assert.equal(card047.baton, 0);
  assert.deepEqual(card047.variants.map(variant => variant.rarity).sort(), ['C', 'P', 'S']);
  assert.deepEqual(card047.variants.filter(variant => variant.rarity === 'P'), [{
    id: 'official-hBP09-047-2982', rarity: 'P',
    image: 'https://hololive-official-cardgame.com/wp-content/images/cardlist/hPR/hBP09-047_P.png',
    sets: ['PRカード'],
    sourceUrl: 'https://hololive-official-cardgame.com/cardlist/?id=2982&%2Fcardlist%2Fcardsearch_ex=&view=text',
  }]);
  assert.equal(card047.keyword.effect, '自分のセンターが〈大空スバル〉なら、自分のデッキを1枚引く。');
  assert.equal(card047.arts[0].name, '風船はいかが？');
  assert.deepEqual(card047.arts[0].cost, ['無色']);
  assert.equal(card047.arts[0].damage, 20);
  assert.equal(card047.arts[0].damageModifier, '+');
  assert.equal(card047.arts[0].effect, '自分のステージに〈大空スバル〉がいるなら、このアーツ+20。');
});

test('FUNNY RAT draws one card after ordinary Collab moves the deck top to Holo Power when Center is Subaru', () => {
  const state = battle({ center: 'hBP09-008' });
  const first = state.players[0].mainDeck[0].id;
  const second = state.players[0].mainDeck[1].id;
  const result = act(state, { type: 'collab', zone: 'back1' }, 0, cards);
  assert.equal(result.players[0].zones.collab.stack.at(-1).number, 'hBP09-047');
  assert.equal(result.players[0].holoPower.at(-1).id, first, 'ordinary Collab places the initial deck top into Holo Power');
  assert.deepEqual(result.players[0].hand.map(card => card.id), [second], 'FUNNY RAT then draws the new deck top');
  assert.equal(result.players[0].mainDeck.length, state.players[0].mainDeck.length - 2);
  assert.equal(result.pendingChoice, null);
});

test('FUNNY RAT does not draw when own Center is not Subaru even if Subaru is elsewhere on own Stage', () => {
  const state = battle({ center: 'hBP09-041', subaruZone: 'back5' });
  const first = state.players[0].mainDeck[0].id;
  const result = act(state, { type: 'collab', zone: 'back1' }, 0, cards);
  assert.equal(result.players[0].holoPower.at(-1).id, first);
  assert.deepEqual(result.players[0].hand, [], `unexpected draw; center=${state.players[0].zones.center.stack.at(-1).number}, back5=${state.players[0].zones.back5.stack.at(-1).number}, log=${JSON.stringify(result.log)}`);
  assert.equal(result.players[0].mainDeck.length, state.players[0].mainDeck.length - 1);
});

test('FUNNY RAT resolves safely when ordinary Collab consumes the last Main Deck card', () => {
  const state = battle({ center: 'hBP09-008' });
  state.players[0].mainDeck = [instance('hBP09-046')];
  const result = act(state, { type: 'collab', zone: 'back1' }, 0, cards);
  assert.equal(result.players[0].holoPower.at(-1).number, 'hBP09-046');
  assert.deepEqual(result.players[0].hand, []);
  assert.equal(result.players[0].mainDeck.length, 0);
  assert.equal(result.pendingChoice, null);
});

test('Balloon Arts gets +20 when the top Holomem on any own Stage position is Subaru', () => {
  const state = battle({ phase: 'performance', subaruZone: 'back5' });
  state.players[0].zones.center = unit('hBP09-047');
  state.players[0].zones.center.cheer = [instance('hY03-001')];
  const paidCheerId = state.players[0].zones.center.cheer[0].id;
  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, cards);
  assert.equal(result.players[1].zones.center.damage, 40);
  assert.equal(result.players[0].zones.center.rested, true);
  assert.deepEqual(result.players[0].zones.center.cheer.map(card => card.id), [paidCheerId]);
  assert.equal(result.pendingChoice, null);
});

test('Balloon Arts bonus ignores an opposing Subaru and a Subaru hidden under another top Holomem', () => {
  for (const state of [
    battle({ phase: 'performance', opponentSubaru: true }),
    battle({ phase: 'performance', subaruZone: 'back5', subaruUnderCard: true }),
  ]) {
    state.players[0].zones.center = unit('hBP09-047');
    state.players[0].zones.center.cheer = [instance('hY03-001')];
    const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, cards);
    assert.equal(result.players[1].zones.center.damage, 20);
  }
});
