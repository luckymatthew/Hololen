import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, conserve } from './hbp09-fixtures.mjs';

function replaceStage(player, zones) {
  for (const old of Object.values(player.zones)) {
    if (old) player.archive.push(...old.stack, ...old.cheer, ...old.attachments);
  }
  player.zones = { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null, ...zones };
}

function setDeck(player, numbers) {
  player.archive.push(...player.mainDeck);
  player.mainDeck = numbers.map(instance);
}

function hbp09_022Fixture({ power = 10, deck = ['hBP04-069', 'hBP04-072'], target = 'hBP03-069' } = {}) {
  const state = fixture();
  state.turn = 8; state.activePlayer = 0; state.firstPlayer = 1; state.phase = 'main';
  const owner = state.players[0];
  owner.oshi = instance('hBP09-001');
  replaceStage(owner, { center: unit('hBP03-069') }); // Watame 1st is the legal substrate for this 2nd.
  owner.zones.center.enteredTurn = 1;
  owner.zones.center.bloomedTurn = 0;
  owner.archive.push(...owner.hand);
  owner.hand = [instance('hBP09-022')];
  owner.archive.push(...owner.holoPower);
  owner.holoPower = Array.from({ length: power }, () => instance('hY01-001'));
  setDeck(owner, deck);
  owner.turnsTaken = 3;
  owner.turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  owner.namedUsageTurns = {};
  owner.oshiSkillTurn = 0;

  const opponent = state.players[1];
  replaceStage(opponent, { center: unit(target), back1: unit('hBP03-069') });
  opponent.turnEvents = { turn: state.turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  return state;
}

function bloom022(state) {
  const bloom = state.players[0].hand.find(card => card.number === 'hBP09-022');
  let next = act(state, { type: 'play', cardId: bloom.id });
  assert.equal(next.pendingChoice?.type, 'bloom');
  next = act(next, { type: 'choose', zone: 'center' }, 0);
  return next;
}

function useSubaruSameLevel(state) {
  let next = act(state, { type: 'oshiSkill' }, 0);
  assert.equal(next.pendingChoice?.type, 'stageTarget', 'Subaru Oshi must ask which opponent Holomem is the level reference');
  assert.ok(next.pendingChoice.options.includes('center'));
  next = act(next, { type: 'choose', zone: 'center' }, 0);
  assert.equal(next.pendingChoice?.type, 'cardSelection', 'Subaru Oshi searches for a matching Bloom-level Subaru');
  return next;
}

test('hBP09-022 always selects one opponent Stage Holomem even below the 10 Holo Power threshold', () => {
  const state = hbp09_022Fixture({ power: 9 });
  const before = structuredClone(state);
  const result = structuredClone(bloom022(state));
  assert.equal(result.pendingChoice?.type, 'stageTarget', 'printed “choose 1 opponent Holomem” is mandatory independently of the later threshold');
  assert.equal(result.pendingChoice.playerIndex, 0);
  assert.ok(result.pendingChoice.options.includes('center'));
  const chosen = act(result, { type: 'choose', zone: 'center' }, 0);
  assert.equal(chosen.players[1].zones.center.hbp09Stage, undefined, 'nine Holo Power does not add 2nd status');
  assert.equal(chosen.players[0].holoPower.length, 9);
  conserve(before, chosen);
});

test('hBP09-022 at exactly 10 Holo Power adds 2nd status without replacing the printed 1st status, then expiry is turn-scoped', () => {
  let state = hbp09_022Fixture({ power: 10 });
  const before = structuredClone(state);
  state = structuredClone(bloom022(state));
  assert.equal(state.pendingChoice?.type, 'stageTarget');
  state = act(state, { type: 'choose', zone: 'center' }, 0);
  const target = state.players[1].zones.center;
  assert.deepEqual(target.hbp09Stage, { stage: '2nd', expiresTurn: 8 });
  assert.equal(cards.find(card => card.number === target.stack.at(-1).number).stage, '1st', 'temporary 2nd does not erase the printed 1st identity');
  const choices = useSubaruSameLevel(state);
  const legal = new Set(choices.pendingChoice.selectableIds.map(id => choices.players[0].mainDeck.find(card => card.id === id)?.number));
  assert.ok(legal.has('hBP04-069'), 'Q706: a matching 1st Subaru remains eligible');
  assert.ok(legal.has('hBP04-072'), 'Q705: a matching 2nd Subaru is also eligible');
  conserve(before, state);

  const nextTurn = structuredClone(state);
  nextTurn.turn = 9;
  nextTurn.players[0].turnEvents.turn = 9;
  nextTurn.players[0].oshiSkillTurn = 0;
  const expiredChoices = useSubaruSameLevel(nextTurn);
  const expiredLegal = new Set(expiredChoices.pendingChoice.selectableIds.map(id => expiredChoices.players[0].mainDeck.find(card => card.id === id)?.number));
  assert.ok(expiredLegal.has('hBP04-069'));
  assert.ok(!expiredLegal.has('hBP04-072'), 'the additional 2nd identity expires outside the effect turn');
});

test('hBP09-022 Arts is 100 base, adds its own +50 at four Holo Power, and keeps the Purple icon separate', () => {
  for (const [power, target, expected] of [[3, 'hBP09-022', 100], [4, 'hBP09-022', 150], [3, 'hBP07-076', 150], [4, 'hBP07-076', 200]]) {
    const state = hbp09_022Fixture({ power });
    state.phase = 'performance';
    const attacker = unit('hBP09-022');
    attacker.cheer = [instance('hY01-001'), instance('hY01-002')];
    replaceStage(state.players[0], { center: attacker });
    replaceStage(state.players[1], { center: unit(target), back1: unit('hBP03-069') });
    const before = structuredClone(state);
    const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0);
    assert.equal(result.players[1].zones.center.damage, expected, `${power} Holo Power against ${target}`);
    conserve(before, result);
  }
});

test('website catalogue retains R/SR identity and the exact hBP09-022 Japanese Bloom and Arts clauses', () => {
  const card = cards.find(entry => entry.number === 'hBP09-022');
  assert.ok(card);
  assert.deepEqual(new Set(card.variants.map(variant => variant.id)), new Set(['hbp09-hBP09-022_R', 'hbp09-hBP09-022_SR']));
  assert.equal(card.jpName, '角巻わため');
  assert.equal(card.stage, '2nd');
  assert.equal(card.hp, 210);
  assert.equal(card.keyword.name, 'わためいとの楽園');
  assert.equal(card.keyword.effect, '相手のステージのホロメン1人を選ぶ。自分のホロパワーが10枚以上あるなら、このターンの間、選んだホロメンは2ndホロメンとしても扱う。');
  assert.equal(card.arts[0].name, '花がきれいだねぇ');
  assert.deepEqual(card.arts[0].cost, ['白', '白']);
  assert.equal(card.arts[0].damage, 100);
  assert.deepEqual(card.arts[0].specialTargets, ['紫']);
  assert.deepEqual(card.arts[0].specialValues, [50]);
  assert.equal(card.arts[0].effect, '自分のホロパワーが4枚以上あるなら、このアーツ+50。');
});
