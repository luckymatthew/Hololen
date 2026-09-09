import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
function setup(back=true){const s=state();s.phase='main';s.players[0].zones.back1=unit('hBP01-099');if(back)s.players[1].zones.back1=unit('AUDIT-DUMMY',{stack:[inst('AUDIT-DUMMY','back')]});return act(s,{type:'collab',zone:'back1'});}
for(const die of [1,2,3,4,5,6,null])test('Edinburgh optional die '+die,()=>{
 let s=setup();assert.equal(s.pendingChoice?.effect,'edinburghRoll');let calls=0;
 s=applyAction(s,0,die===null?{type:'choose',skip:true}:{type:'choose',optionId:'roll'},pool,()=>{calls++;return(die-.5)/6;});
 if(die===null)assert.equal(calls,0);
 if(die!==null&&die%2===1){
  assert.equal(s.pendingChoice?.effect,'swapCenter');assert.throws(()=>act(s,{type:'choose',skip:true}));assert.throws(()=>act(s,{type:'choose',zone:'center'}));
  s=act(JSON.parse(JSON.stringify(s)),{type:'choose',zone:'back1'});assert.equal(s.players[1].zones.center.stack[0].id,'back');assert.equal(s.players[1].zones.back1.stack[0].id,'AUDIT-DUMMY');
 }else assert.equal(s.players[1].zones.center.stack[0].id,'AUDIT-DUMMY');
 assert.equal(s.pendingChoice,null);
});
test('Edinburgh odd result with no back finishes cleanly',()=>{let s=setup(false);s=applyAction(s,0,{type:'choose',optionId:'roll'},pool,()=>0);assert.equal(s.pendingChoice,null);});
