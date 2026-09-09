import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,state} from './fixtures/simulator-audit.mjs';
for(const used of [false,true])test('021 mushroom event ReGLOSS heal '+used,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP04-021');s.players[0].zones.back2=unit('hBP03-048',{damage:40});
 s.players[0].turnEvents={turn:s.turn,supports:used?[cards.find(c=>['supportEvent','supportEventLimited'].includes(c.typeCode)&&c.tags.includes('#きのこ')).number]:[],arts:[]};
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(used){assert.equal(s.pendingChoice.optional,false);assert.ok(s.pendingChoice.options.includes('back2'));assert.ok(!s.pendingChoice.options.includes('center'));s=applyAction(s,0,{type:'choose',zone:'back2'},pool,()=>0);}
 assert.equal(s.pendingChoice,null);assert.equal(s.players[0].zones.back2.damage,used?20:40);
});
