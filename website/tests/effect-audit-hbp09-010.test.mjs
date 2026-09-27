import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act, conserve } from './hbp09-fixtures.mjs';

const opponentTools = ['hBP01-114', 'hBP01-115'];
const toolNumbers = new Set(cards.filter(card => card.typeCode === 'supportTool').map(card => card.number));

function artState({ tools = opponentTools } = {}) {
  const state = fixture();
  state.turn = 8;
  state.activePlayer = 0;
  state.phase = 'performance';
  state.players[0].turnEvents = { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  const subaru = unit('hBP09-009', 2);
  subaru.stack.push(instance('hBP09-010'));
  subaru.enteredTurn = 1;
  subaru.bloomedTurn = 7;
  state.players[0].zones.center = subaru;
  state.players[1].zones.center = unit('hBP09-064');
  state.players[1].zones.back1 = unit('hBP09-064');
  assert.equal(state.players[1].zones.center.attachments.length, 0);
  assert.equal(state.players[1].zones.back1.attachments.length, 0);
  if (tools[0]) state.players[1].zones.center.attachments.push(instance(tools[0]));
  if (tools[1]) state.players[1].zones.back1.attachments.push(instance(tools[1]));
  return state;
}

function useArt(state) {
  return act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
}

test('hBP09-010 Arts makes the acting player choose exactly one opponent Tool, archives it under its owner, then deals 30 damage', () => {
  const before = artState();
  assert.ok(opponentTools.every(number => toolNumbers.has(number)), 'fixture attachments must be Support Tools');
  const afterAttack = useArt(before);

  assert.equal(afterAttack.pendingChoice?.type, 'cardSelection');
  assert.equal(afterAttack.pendingChoice?.playerIndex, 0, 'the Arts player chooses which opposing Tool to archive');
  assert.equal(afterAttack.pendingChoice?.optional, false, 'the printed instruction is mandatory when an eligible Tool exists');
  assert.equal(afterAttack.pendingChoice?.min, 1);
  assert.equal(afterAttack.pendingChoice?.max, 1);
  assert.deepEqual(new Set(afterAttack.pendingChoice.cards.map(card => card.number)), new Set(opponentTools));
  assert.equal(afterAttack.players[1].zones.center.damage, 0, 'the Arts damage remains pending until its choice resolves');
  assert.throws(() => act(afterAttack, { type: 'choose', skip: true }), /cannot be skipped|不可跳過|不能略過/iu);

  const selected = afterAttack.pendingChoice.cards.find(card => card.number === 'hBP01-115');
  assert.ok(selected);
  const invalidInput = structuredClone(afterAttack);
  assert.throws(() => act(afterAttack, { type: 'choose', cardIds: ['not-selectable'] }), /selectable|選擇/u);
  assert.deepEqual(afterAttack, invalidInput, 'a rejected stale/foreign Tool choice must not mutate the saved pending state');

  const resumed = JSON.parse(JSON.stringify(afterAttack));
  const settled = act(resumed, { type: 'choose', cardIds: [selected.id] });
  assert.equal(settled.pendingChoice, null);
  assert.equal(settled.players[1].archive.filter(card => card.id === selected.id).length, 1, 'the chosen Tool moves to its owner’s Archive');
  assert.ok(settled.players[1].zones.back1.attachments.some(card => card.id === selected.id) === false);
  assert.ok(settled.players[1].zones.center.attachments.some(card => card.number === 'hBP01-114'), 'the unselected opponent Tool remains attached');
  assert.equal(settled.players[1].zones.center.damage, 30);
  assert.equal(settled.players[0].zones.center.rested, true);
  conserve(before, settled);
});

test('hBP09-010 Arts still deals its printed 30 when the opponent has no Tool and creates no impossible choice', () => {
  const before = artState({ tools: [] });
  const settled = useArt(before);
  assert.equal(settled.pendingChoice, null);
  assert.equal(settled.players[1].zones.center.damage, 30);
  assert.equal(settled.players[1].archive.some(card => opponentTools.includes(card.number)), false);
  conserve(before, settled);
});

test('hBP09-010 Collab effect draws two, then puts the selected two hand cards on deck bottom in the chosen order', () => {
  const before = fixture();
  before.turn = 8;
  before.activePlayer = 0;
  before.phase = 'main';
  const player = before.players[0];
  const subaru = unit('hBP09-009');
  subaru.stack.push(instance('hBP09-010'));
  subaru.enteredTurn = 1;
  subaru.bloomedTurn = 7;
  player.zones.back1 = subaru;
  const chosenToBottom = player.mainDeck.splice(5, 2);
  player.hand.push(...chosenToBottom);
  assert.equal(chosenToBottom.length, 2);
  const collabPower = player.mainDeck[0];
  const oldTop = player.mainDeck.slice(1, 3);
  const oldRemainder = player.mainDeck.slice(3);

  const afterCollab = act(before, { type: 'collab', zone: 'back1' });
  assert.equal(afterCollab.players[0].zones.collab.stack.at(-1).number, 'hBP09-010');
  assert.equal(afterCollab.players[0].holoPower.at(-1).id, collabPower.id, 'normal Collab rule moves the deck top to Holo Power before the effect draws');
  assert.equal(afterCollab.players[0].hand.length, player.hand.length + 2, 'draw happens before the bottom-deck choice');
  assert.equal(afterCollab.pendingChoice?.type, 'cardSelection');
  assert.equal(afterCollab.pendingChoice?.playerIndex, 0);
  assert.equal(afterCollab.pendingChoice?.optional, false);
  assert.equal(afterCollab.pendingChoice?.min, 2);
  assert.equal(afterCollab.pendingChoice?.max, 2);
  assert.deepEqual(new Set(afterCollab.pendingChoice.selectableIds), new Set([...player.hand, ...oldTop].map(card => card.id)));

  const settled = act(afterCollab, { type: 'choose', cardIds: chosenToBottom.map(card => card.id) });
  assert.equal(settled.pendingChoice, null);
  assert.deepEqual(settled.players[0].mainDeck.map(card => card.id), [
    ...oldRemainder.map(card => card.id),
    ...chosenToBottom.map(card => card.id),
  ], 'selection order is preserved at the deck bottom');
  assert.deepEqual(settled.players[0].hand.map(card => card.id), oldTop.map(card => card.id));
  conserve(before, settled);
});
