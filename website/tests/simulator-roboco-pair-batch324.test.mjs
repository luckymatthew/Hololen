import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
for(const skip of [true,false])test('Roboco optional pair search skip '+skip,()=>{
 const fan=cards.find(c=>c.jpName==='ろぼさー');let s=state('hBP06-062');s.phase='main';s.firstPlayer=1;s.players[0].turnsTaken=1;
 s.players[0].zones.back1=unit('hBP06-062');s.players[0].mainDeck=[inst('AUDIT-DUMMY','hp'),inst(fan.number,'f1'),inst(fan.number,'f2')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 assert.equal(s.pendingChoice.min,2);assert.equal(s.pendingChoice.optional,true);
 assert.throws(()=>applyAction(s,0,{type:'choose',cardIds:['f1']},pool,()=>0));
 s=applyAction(s,0,skip?{type:'choose',skip:true}:{type:'choose',cardIds:['f1','f2']},pool,()=>0);
 assert.equal(s.players[0].hand.length,skip?0:2);
});
