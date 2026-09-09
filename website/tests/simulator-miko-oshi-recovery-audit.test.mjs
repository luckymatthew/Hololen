import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst} from './fixtures/simulator-audit.mjs';
function start(face){
 const s=state();s.phase='main';s.players[0].oshi=inst('hBP03-003');s.players[0].holoPower=[inst('AUDIT-DUMMY','p1'),inst('AUDIT-DUMMY','p2')];
 s.players[0].archive=[inst('hBP03-107','a'),inst('hBP03-107','b'),inst('hBP01-119','wrong')];
 return applyAction(s,0,{type:'oshiSkill'},pool,()=>(face-.5)/6);
}
for(const face of [1,2,3,4,5,6])test('Miko 35P face '+face,()=>{
 const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>(face-.5)/6);
 let e=act(start(face),{type:'choose',optionId:'roll'});const count=[3,5].includes(face)?2:1;
 assert.equal(e.pendingChoice.min,count);assert.equal(e.pendingChoice.optional,false);assert.throws(()=>act(e,{type:'choose',skip:true}));
 e=act(e,{type:'choose',cardIds:count===2?['a','b']:['a']});assert.equal(e.players[0].hand.length,count);
});
test('Miko can decline dice while retaining skill cost',()=>{
 const e=applyAction(start(1),0,{type:'choose',skip:true},pool,()=>0);
 assert.equal(e.pendingChoice,null);assert.equal(e.players[0].hand.length,0);assert.equal(e.players[0].holoPower.length,0);
});
