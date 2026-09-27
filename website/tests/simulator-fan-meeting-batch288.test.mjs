import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';

test('Fan Meeting permits fail-to-find its hidden-deck Fan search and then shuffles', () => {
  const fan=cards.find(c=>c.typeCode==='supportFan');
  let current=state();
  current.phase='main';
  current.players[0].hand=[inst('hBP03-089','event')];
  current.players[0].mainDeck=[inst(fan.number,'yes'),inst('AUDIT-DUMMY','no')];
  current=applyAction(current,0,{type:'play',cardId:'event'},pool,()=>0);
  assert.equal(current.pendingChoice.optional,false,'the played Support still resolves as mandatory');
  assert.equal(current.pendingChoice.min,0,'a hidden-deck card-info search permits no selection even when a match exists');
  assert.deepEqual(current.pendingChoice.cards.map(c=>c.id),['yes']);
  assert.throws(() => applyAction(current,0,{type:'choose',skip:true},pool,()=>0),/cannot be skipped/u);
  assert.equal(current.pendingChoice.min,0,'rejecting an explicit effect skip leaves the hidden search pending');
  current=applyAction(current,0,{type:'choose',cardIds:[]},pool,()=>0);
  assert.equal(current.pendingChoice,null);
  assert.equal(current.players[0].hand.length,0,'no Fan enters hand after failing to find');
  assert.ok(current.players[0].mainDeck.some(c=>c.id==='yes'),'the matching Fan remains in the deck');
});

for(const available of [true,false]) test('Fan Meeting completes with a selected match '+available,()=>{
  const fan=cards.find(c=>c.typeCode==='supportFan');
  let current=state();
  current.phase='main';
  current.players[0].hand=[inst('hBP03-089','event')];
  current.players[0].mainDeck=[...(available?[inst(fan.number,'yes')]:[]),inst('AUDIT-DUMMY','no')];
  current=applyAction(current,0,{type:'play',cardId:'event'},pool,()=>0);
  if(available){
    assert.equal(current.pendingChoice.optional,false);
    assert.equal(current.pendingChoice.min,0);
    assert.deepEqual(current.pendingChoice.cards.map(c=>c.id),['yes']);
    current=applyAction(current,0,{type:'choose',cardIds:['yes']},pool,()=>0);
    assert.equal(current.players[0].hand[0].id,'yes');
  } else assert.equal(current.pendingChoice,null);
});
