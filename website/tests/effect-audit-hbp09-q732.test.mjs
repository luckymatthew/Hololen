import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAction, isActionCandidateLegal} from '../lib/simulator/engine.mjs';

const cards = JSON.parse(readFileSync(new URL('../public/cards.json', import.meta.url), 'utf8')).cards;
const map = new Map(cards.map(card => [card.number, card]));
let serial = 0;
const instance = number => ({id:`q732-web-${++serial}`, number});
const unit = (number, damage = 0) => ({
  stack:[instance(number)], cheer:[], attachments:[], damage, rested:false,
  enteredTurn:1, bloomedTurn:0, collabbedTurn:0, returnSlot:null, modifiers:[], skipUnrestTurn:0,
});

function fixture() {
  const player = (name, oshi) => ({
    name, oshi:instance(oshi), ready:true, setupDone:true, turnsTaken:3,
    mainDeck:Array.from({length:12}, () => instance('hBP01-106')),
    cheerDeck:[], hand:[], life:[], holoPower:[], archive:[], removed:[],
    zones:{center:null, collab:null, back1:null, back2:null, back3:null, back4:null, back5:null},
    collabTurn:0, batonTurn:0, limitedTurn:0, limitedUsesCount:0,
    limitedAllowanceTurn:0, limitedAllowance:1, oshiSkillTurn:0, spOshiSkillUsed:false,
    namedUsageTurns:{}, modifiers:[], turnEvents:{turn:3,supports:[],arts:[],bloomCount:0,cheerArchived:0,deckArchived:0,stageReturned:0},
  });
  const own = player('Matsuri', 'hBP06-008');
  const opponent = player('Opponent', 'hBP06-008');
  own.zones.center = unit('hBP06-077', 100);
  own.zones.back1 = unit('hBP09-087');
  own.zones.back2 = unit('hBP06-077', 100);
  own.hand = [instance('hBP06-086'), instance('hBP06-086'), instance('hBP06-086')];
  own.holoPower = [instance('hBP01-106')];
  opponent.zones.center = unit('hBP06-077');
  return {status:'playing', phase:'main', turn:3, activePlayer:0, firstPlayer:1, players:[own,opponent], effectQueue:[], pendingChoice:null, log:[], knockouts:[], lifeLosses:[]};
}

function act(state, action) { return applyAction(state, 0, action, cards, () => 0.25); }

function useLimited(state, id, targetZone) {
  state = act(state, {type:'play', cardId:id});
  assert.equal(state.pendingChoice?.type, 'stageTarget', 'the real LIMITED Support effect should resolve before the next action');
  assert.ok(state.pendingChoice.options.includes(targetZone));
  state = act(state, {type:'choose', zone:targetZone});
  assert.equal(state.pendingChoice, null);
  return state;
}

function collabMatsuri(state) {
  state = act(state, {type:'collab', zone:'back1'});
  assert.equal(state.players[0].zones.collab.stack.at(-1).number, 'hBP09-087', 'a 2nd Matsuri in Back is a legal Collab candidate');
  assert.equal(state.pendingChoice?.type, 'optionChoice');
  assert.ok(state.pendingChoice.modeOptions.some(option => option.id === 'yes'));
  state = act(state, {type:'choose', optionId:'yes'});
  assert.equal(state.pendingChoice, null);
  assert.equal(state.players[0].limitedAllowanceTurn, state.turn);
  assert.equal(state.players[0].limitedAllowance, 2);
  return state;
}

function proveThirdLimitedIsUnavailable(state) {
  const third = state.players[0].hand.find(card => card.number === 'hBP06-086');
  assert.ok(third, 'the third real LIMITED Support remains available for the negative action');
  assert.equal(state.players[0].limitedUsesCount, 2);
  assert.equal(isActionCandidateLegal(state, 0, {type:'play', cardId:third.id}, cards), false);
  const before = structuredClone(state);
  assert.throws(() => act(state, {type:'play', cardId:third.id}), /LIMITED/u);
  assert.deepEqual(state, before, 'rejecting the extra LIMITED Support must not mutate the match');
}

test('Q732 SP Matsuri, two LIMITED Supports, then hBP09-087 Collab does not grant two more', () => {
  let state = fixture();
  state = act(state, {type:'spOshiSkill'});
  assert.equal(state.players[0].limitedAllowance, 2);
  assert.equal(state.players[0].holoPower.length, 0);
  state = useLimited(state, state.players[0].hand[0].id, 'center');
  assert.equal(state.players[0].limitedUsesCount, 1);
  state = useLimited(state, state.players[0].hand.find(card => card.number === 'hBP06-086').id, 'back2');
  assert.equal(state.players[0].limitedUsesCount, 2);
  state = collabMatsuri(state);
  assert.equal(state.players[0].limitedUsesCount, 2, 'the Collab effect sets the same cap; it does not add another two');
  proveThirdLimitedIsUnavailable(state);
});

test('Q732 two allowance effects remain a cap of two in the other activation order', () => {
  let state = fixture();
  state = collabMatsuri(state);
  state = act(state, {type:'spOshiSkill'});
  assert.equal(state.players[0].limitedAllowance, 2);
  state = useLimited(state, state.players[0].hand[0].id, 'center');
  state = useLimited(state, state.players[0].hand.find(card => card.number === 'hBP06-086').id, 'back2');
  proveThirdLimitedIsUnavailable(state);
});

test('CR 1.9.0 8.4.2 allows an active 2nd Holomem in Back to Collab', () => {
  const state = fixture();
  assert.equal(map.get('hBP09-087')?.stage, '2nd');
  assert.equal(isActionCandidateLegal(state, 0, {type:'collab', zone:'back1'}, cards), true);
  const next = act(state, {type:'collab', zone:'back1'});
  assert.equal(next.players[0].zones.collab.stack.at(-1).number, 'hBP09-087');
});

test('Q509 the Matsuri SP skill does not waive the first player first-turn LIMITED restriction', () => {
  let state = fixture();
  state.turn = 1;
  state.firstPlayer = 0;
  state.players[0].turnsTaken = 1;
  state.players[0].turnEvents = {turn:1,supports:[],arts:[],bloomCount:0,cheerArchived:0,deckArchived:0,stageReturned:0};
  state = act(state, {type:'spOshiSkill'});
  assert.equal(state.players[0].limitedAllowanceTurn, 1);
  assert.equal(state.players[0].limitedAllowance, 2);
  const limited = state.players[0].hand[0];
  assert.equal(isActionCandidateLegal(state, 0, {type:'play',cardId:limited.id}, cards), false);
  assert.throws(() => act(state, {type:'play',cardId:limited.id}), /先攻玩家第 1 回合/u);
});
