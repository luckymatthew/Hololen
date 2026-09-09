import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,fund,attack} from './fixtures/simulator-audit.mjs';
function start(){const s=state('hBP03-028');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP03-028').arts[1].cost);s.players[1].zones.collab=unit('AUDIT-DUMMY');return applyAction(s,0,{...attack,artIndex:1},pool,()=>0);}
for(const face of [1,2,3,4,5,6])test('Miko Arts face '+face,()=>{
 const e=applyAction(start(),0,{type:'choose',optionId:'roll'},pool,()=>(face-.5)/6);
 assert.equal(e.players[1].zones.center.damage,face===1?50:70);assert.equal(e.players[1].zones.collab.damage,[3,5].includes(face)?20:0);
});
test('Miko Arts decline retains only base damage',()=>{
 const e=applyAction(start(),0,{type:'choose',skip:true},pool,()=>0);assert.equal(e.players[1].zones.center.damage,50);assert.equal(e.players[1].zones.collab.damage,0);
});
