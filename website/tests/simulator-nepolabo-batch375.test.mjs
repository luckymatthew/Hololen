import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
for(const count of [1,2])test('Nepolabo sequential required Cheer '+count,()=>{
 let s=state('hBP07-083');s.phase='main';s.players[0].oshi=inst('hBP07-007');s.players[0].zones.back1=unit('hBP07-083');s.players[0].holoPower=[inst('AUDIT-DUMMY','p1'),inst('AUDIT-DUMMY','p2')];s.players[0].archive=Array.from({length:count},(_,i)=>inst('hY06-001','c'+i));s=applyAction(s,0,{type:'oshiSkill'},pool,()=>0);assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));s=applyAction(s,0,{type:'choose',cardIds:['c0']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[0].zones.back1.cheer.length,1);
 if(count===2){assert.deepEqual(s.pendingChoice.selectableIds,['c1']);assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['c1']},pool,()=>0);assert.deepEqual(s.pendingChoice.options,['center']);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer.length,1);}else assert.equal(s.players[0].zones.center.cheer.length,0);assert.equal(s.pendingChoice,null);
});

