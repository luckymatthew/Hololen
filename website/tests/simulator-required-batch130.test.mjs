import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const fan of [true,false])test('AZKi pioneer '+fan,()=>{
 let s=state('hBP05-024');fund(s.players[0].zones.center,['綠','綠']);if(fan)s.players[0].zones.center.attachments=[inst('hBP01-124','fan')];s.players[0].cheerDeck=[inst('hY01-001','top')];
 s=applyAction(s,0,attack,pool,()=>0);if(fan){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['center']);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}
 assert.equal(s.players[0].zones.center.cheer.length,fan?3:2);assert.equal(s.pendingChoice,null);
});
for(const pay of [true,false])test('Polka paid damage '+pay,()=>{
 let s=state('hBP05-032');fund(s.players[0].zones.center,['無色','無色']);s.players[0].hand=[inst('AUDIT-DUMMY','cost')];
 s=applyAction(s,0,attack,pool,()=>0);s=applyAction(s,0,pay?{type:'choose',cardIds:['cost']}:{type:'choose',skip:true},pool,()=>0);
 if(pay){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}
 assert.equal(s.players[1].zones.center.damage,pay?60:50);assert.equal(s.pendingChoice,null);
});
for(const loseLife of [true,false])test('AZKi Buzz life '+loseLife,()=>{
 const s=state();s.players[1].zones.back1=unit('hBP05-024',{damage:10000});s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'back1',sourceZone:'center',amount:10,loseLife,sourceName:'test'}];
 const r=applyAction(s,0,attack,pool,()=>.5);assert.equal(r.players[1].zones.back1,null);assert.equal(r.players[1].life.length,loseLife?3:5);
});
