import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const timing of ['current','previous','none'])test('Meal front damage '+timing,()=>{
 let s=state('hBP05-039');fund(s.players[0].zones.center,['紅','無色']);s.players[1].zones.collab=unit('AUDIT-DUMMY');
 s.players[0].turnEvents={turn:timing==='previous'?s.turn-1:s.turn,supports:timing==='none'?[]:['hBP04-091'],arts:[]};
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,timing==='current'?60:40);assert.equal(s.players[1].zones.collab.damage,timing==='current'?20:0);assert.equal(s.pendingChoice,null);
});
for(const back of [true,false])test('Required back damage '+back,()=>{
 let s=state('hBP05-047');fund(s.players[0].zones.center,['無色']);if(back)s.players[1].zones.back1=unit('AUDIT-DUMMY');
 s=applyAction(s,0,attack,pool,()=>0);if(back){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['back1']);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[1].zones.back1.damage,10);}
 assert.equal(s.players[1].zones.center.damage,20);assert.equal(s.pendingChoice,null);
});
for(const loseLife of [true,false])test('039 Buzz life '+loseLife,()=>{
 const s=state();s.players[1].zones.back1=unit('hBP05-039',{damage:10000});s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'back1',sourceZone:'center',amount:10,loseLife,sourceName:'test'}];
 const r=applyAction(s,0,attack,pool,()=>.5);assert.equal(r.players[1].zones.back1,null);assert.equal(r.players[1].life.length,loseLife?3:5);
});
