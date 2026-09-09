import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const count of [0,1,3])test('060 center Cheer count '+count,()=>{
 const s=state('hBP04-060');fund(s.players[0].zones.center,['紫','無色']);fund(s.players[1].zones.center,Array(count).fill('白'));s.players[1].zones.collab=unit('AUDIT-DUMMY');fund(s.players[1].zones.collab,['白','白']);
 const next=applyAction(s,0,attack,pool,()=>0);assert.equal(next.players[1].zones.center.damage,40+count*10);assert.equal(next.players[1].zones.collab.damage,count*10);
});
for(const loseLife of [true,false])test('060 Buzz printed life loss '+loseLife,()=>{
 const s=state();s.players[1].zones.back1=unit('hBP04-060',{damage:10000});
 s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'back1',sourceZone:'center',amount:10,loseLife,sourceName:'test'}];
 const next=applyAction(s,0,attack,pool,()=>.5);assert.equal(next.players[1].zones.back1,null);assert.equal(next.players[1].life.length,loseLife?3:5);assert.ok(next.players[1].archive.some(c=>c.number==='hBP04-060'));
});

