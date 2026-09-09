import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit} from './fixtures/simulator-audit.mjs';
function start(){const s=state();s.phase='main';s.players[0].zones.back1=unit('hBP03-026');return applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);}
for(const face of [1,2,3,4,5,6])test('Miko meeting face '+face,()=>{
 const e=applyAction(start(),0,{type:'choose',optionId:'roll'},pool,()=>(face-.5)/6);
 assert.equal(e.players[1].zones.center.damage,face===1?0:10);assert.equal(e.players[0].hand.length,[3,5].includes(face)?1:0);
});
test('Miko meeting decline does neither draw nor damage',()=>{
 const e=applyAction(start(),0,{type:'choose',skip:true},pool,()=>0);assert.equal(e.players[0].hand.length,0);assert.equal(e.players[1].zones.center.damage,0);
});
