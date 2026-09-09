import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst} from './fixtures/simulator-audit.mjs';
for(const die of [2,3,6])test('Fan circle mandatory successful Cheer '+die,()=>{
 let s=state();s.phase='main';s.players[0].hand=[inst('hSD01-020','play')];s.players[0].archive=[inst('hY01-001','cheer')];s=applyAction(s,0,{type:'play',cardId:'play'},pool,()=>(die-1)/6);
 if(die>=3){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['cheer']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer[0].id,'cheer');}else assert.equal(s.pendingChoice,null);
});
