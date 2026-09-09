import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const use of [true,false])test('0790 optional two cheer '+use,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP07-090');s.players[0].archive=[inst('hY01-001','a'),inst('hY01-001','b')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 assert.equal(s.pendingChoice.optional,true);assert.equal(s.pendingChoice.min,2);
 if(use){
 assert.throws(()=>applyAction(s,0,{type:'choose',cardIds:['a']},pool,()=>0));
 s=applyAction(s,0,{type:'choose',cardIds:['a','b']},pool,()=>0);assert.deepEqual(s.pendingChoice.options,['collab']);
 s=applyAction(s,0,{type:'choose',zone:'collab'},pool,()=>0);
 }else s=applyAction(s,0,{type:'choose',skip:true},pool,()=>0);
 assert.equal(s.players[0].zones.collab.cheer.length,use?2:0);
});
