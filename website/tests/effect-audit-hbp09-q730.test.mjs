import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAction, publicRoomState} from '../lib/simulator/engine.mjs';

const cards = JSON.parse(readFileSync(new URL('../public/cards.json', import.meta.url), 'utf8')).cards;
const map = new Map(cards.map(card => [card.number, card]));
let serial = 0;
const instance = number => ({id:`q730-web-${++serial}`, number});
const unit = number => ({stack:[instance(number)], cheer:[], attachments:[], damage:0, rested:false, enteredTurn:1, bloomedTurn:0, collabbedTurn:0, returnSlot:null, modifiers:[], skipUnrestTurn:0});

function fixture({emptyDeck=false, multipleBlooms=false}={}) {
  const oshi = instance('hBP07-001');
  const otherOshi = instance('hBP07-001');
  const state = {
    status:'playing', players:[
      {name:'Kronii',oshi,ready:true,setupDone:true,turnsTaken:2,mainDeck:[],cheerDeck:[],hand:[],life:[],holoPower:[],archive:[],zones:{center:unit('hBP07-050'),collab:null,back1:multipleBlooms?unit('hBP07-051'):null,back2:multipleBlooms?unit('hBP01-092'):null,back3:null,back4:null,back5:null},namedUsageTurns:{},oshiSkillTurn:0,spOshiSkillUsed:false,collabTurn:0,batonTurn:0,turnEvents:{turn:3,supports:[],arts:[],bloomCount:0,cheerArchived:0,deckArchived:0,stageReturned:0}},
      {name:'Opponent',oshi:otherOshi,ready:true,setupDone:true,turnsTaken:2,mainDeck:[instance('hBP09-006')],cheerDeck:[],hand:[instance('hBP09-006')],life:[],holoPower:[],archive:[],zones:{center:unit('hBP01-092'),collab:null,back1:null,back2:null,back3:null,back4:null,back5:null},namedUsageTurns:{},oshiSkillTurn:0,spOshiSkillUsed:false,collabTurn:0,batonTurn:0},
    ],activePlayer:0,firstPlayer:0,winner:null,turn:3,phase:'main',pendingChoice:null,log:[],effectQueue:[],knockouts:[],lifeLosses:[]
  };
  const player = state.players[0];
  player.hand = multipleBlooms ? [instance('hBP09-063'),instance('hBP09-063'),instance('hBP09-063')] : [instance('hBP09-063')];
  if (!emptyDeck) player.mainDeck = [instance('hBP09-005'),instance('hBP09-006'),instance('hBP09-007')];
  return state;
}

function bloom(state, cardId, zone) {
  state = applyAction(state,0,{type:'play',cardId},cards,()=>0.25);
  assert.equal(state.pendingChoice?.type,'bloom');
  assert.ok(state.pendingChoice.options.includes(zone));
  return applyAction(state,0,{type:'choose',zone},cards,()=>0.25);
}

function countInstances(state) {
  return state.players.flatMap(player => [player.oshi,...player.mainDeck,...player.cheerDeck,...player.hand,...player.archive,...player.holoPower,...player.life,...Object.values(player.zones).filter(Boolean).flatMap(unit=>[...unit.stack,...unit.cheer,...unit.attachments])]).map(card=>card.id).sort();
}

test('Q730 Student of Time takes the actual deck-bottom card without revealing it',()=>{
  let state=fixture();
  const [top,middle,bottom]=state.players[0].mainDeck;
  const before=countInstances(state);
  state=bloom(state,state.players[0].hand[0].id,'center');

  assert.equal(state.pendingChoice,null);
  assert.deepEqual(state.players[0].hand.map(card=>card.id),[bottom.id]);
  assert.deepEqual(state.players[0].mainDeck.map(card=>card.id),[top.id,middle.id]);
  assert.deepEqual(countInstances(state),before);
  assert.equal(JSON.stringify(state.log).includes(bottom.id),false,'the face-down draw must not be logged as a reveal');

  const opponentView=publicRoomState(state,1,cards);
  assert.deepEqual(opponentView.players[0].hand,[null]);
  assert.equal(opponentView.players[0].handCount,1);
  assert.equal(JSON.stringify(opponentView).includes(bottom.id),false,'the opponent view must not reveal the drawn card identity');
  const ownerView=publicRoomState(state,0,cards);
  assert.equal(ownerView.players[0].hand[0].id,bottom.id);
});

test('Q730 once-per-turn name limit spans copies and refreshes on the next turn',()=>{
  let state=fixture({multipleBlooms:true});
  const [top,middle,bottom]=state.players[0].mainDeck;
  const [first,second,third]=state.players[0].hand;

  state=bloom(state,first.id,'center');
  assert.deepEqual(state.players[0].hand.map(card=>card.id),[second.id,third.id,bottom.id]);
  assert.equal(state.players[0].namedUsageTurns['hbp09:Student-of-Time'],3);

  state=bloom(state,second.id,'back1');
  assert.deepEqual(state.players[0].hand.map(card=>card.id),[third.id,bottom.id],'a second copy cannot use the named effect in the same turn');
  assert.deepEqual(state.players[0].mainDeck.map(card=>card.id),[top.id,middle.id]);

  state.turn=4;
  state.players[0].turnsTaken=3;
  state.players[0].turnEvents={turn:4,supports:[],arts:[],bloomCount:0,cheerArchived:0,deckArchived:0,stageReturned:0};
  state=bloom(state,third.id,'back2');
  assert.deepEqual(state.players[0].hand.map(card=>card.id),[bottom.id,middle.id]);
  assert.deepEqual(state.players[0].mainDeck.map(card=>card.id),[top.id]);
  assert.equal(state.players[0].namedUsageTurns['hbp09:Student-of-Time'],4);
});

test('Q195 an empty deck during an effect draw does not cause an immediate loss',()=>{
  let state=fixture({emptyDeck:true});
  state=bloom(state,state.players[0].hand[0].id,'center');
  assert.equal(state.status,'playing');
  assert.equal(state.winner,null);
  assert.equal(state.players[0].hand.length,0);
  assert.equal(state.players[0].mainDeck.length,0);
  assert.equal(state.pendingChoice,null);
});
