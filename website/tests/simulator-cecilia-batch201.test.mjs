import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const count of [0,2])test('0827 count before source rests '+count,()=>{
 let s=state('hBP08-027');fund(s.players[0].zones.center,['綠','無色','無色','無色']);
 for(let i=0;i<count;i++)s.players[0].zones['back'+(i+1)]=unit('hBP08-024',{rested:true});
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[0].hand.length,count);assert.equal(s.players[0].zones.center.rested,true);
});
for(const count of [0,2])test('0827 required cheer count '+count,()=>{
 let s=state('hBP08-023');s.phase='main';s.players[0].hand=[inst('hBP08-027','bloom')];s.players[0].archive=[inst('hY01-001','a'),inst('hY01-001','b')];
 for(let i=0;i<count;i++)s.players[0].zones['back'+(i+1)]=unit('hBP08-024',{rested:true});
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 if(count){assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,2);s=applyAction(s,0,{type:'choose',cardIds:['a','b']},pool,()=>0);
 for(let i=0;i<2;i++){assert.deepEqual(s.pendingChoice.options,['center']);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}}
 assert.equal(s.pendingChoice,null);assert.equal(s.players[0].zones.center.cheer.length,count);
});
