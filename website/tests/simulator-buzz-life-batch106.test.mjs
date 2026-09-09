import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,attack} from './fixtures/simulator-audit.mjs';
for(const loseLife of [true,false])test('042 Buzz printed life loss '+loseLife,()=>{
 const s=state();s.players[1].zones.back1=unit('hBP04-042',{damage:10000});
 s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'back1',sourceZone:'center',amount:10,loseLife,sourceName:'test'}];
 const next=applyAction(s,0,attack,pool,()=>.5);assert.equal(next.players[1].zones.back1,null);assert.equal(next.players[1].life.length,loseLife?3:5);assert.ok(next.players[1].archive.some(c=>c.number==='hBP04-042'));
});

