import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,inst,state,attack} from './fixtures/simulator-audit.mjs';
for(const id of ['base','top'])test('077 required stack return '+id,()=>{
 const s=state();s.players[1].zones.back1=unit('hBP04-077',{stack:[inst('AUDIT-DUMMY','base'),inst('hBP04-077','top')],damage:10000});s.players[1].archive=[inst('AUDIT-DUMMY','unrelated')];s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'back1',sourceZone:'center',amount:10,loseLife:false,sourceName:'test'}];
 let next=applyAction(s,0,attack,pool,()=>0);assert.equal(next.pendingChoice.optional,false);assert.deepEqual(next.pendingChoice.selectableIds,['base','top']);next=applyAction(next,1,{type:'choose',cardIds:[id]},pool,()=>0);assert.equal(next.players[1].hand[0].id,id);assert.ok(next.players[1].archive.some(c=>c.id==='unrelated'));
});
