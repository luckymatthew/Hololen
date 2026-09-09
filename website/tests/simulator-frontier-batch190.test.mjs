import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,state} from './fixtures/simulator-audit.mjs';
for(const count of [1,2])test('07100 required sequential cheer '+count,()=>{
 let s=state('hBP07-064');s.phase='main';s.players[0].hand=[inst('hBP07-100','event')];
 s.players[0].archive=[inst('hBP07-064','return'),inst('hBP07-100','old'),...Array.from({length:count},(_,i)=>inst('hY01-001','cheer'+i))];
 s=applyAction(s,0,{type:'play',cardId:'event'},pool,()=>0);s=applyAction(s,0,{type:'choose',cardIds:['return']},pool,()=>0);
 for(let i=0;i<count;i++){
 assert.equal(s.pendingChoice.optional,false);
 s=applyAction(s,0,{type:'choose',cardIds:['cheer'+i]},pool,()=>0);
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 }
 assert.equal(s.pendingChoice,null);assert.equal(s.players[0].zones.center.cheer.length,count);
});
