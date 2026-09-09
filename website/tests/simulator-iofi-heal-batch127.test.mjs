import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
for(const pay of [true,false])test('Iofi paid heal '+pay,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP05-019',{cheer:[inst('hY01-001','cost')],damage:40});s.players[0].zones.center.damage=40;
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 assert.equal(s.pendingChoice.optional,true);
 s=applyAction(s,0,pay?{type:'choose',cheerId:'cost'}:{type:'choose',skip:true},pool,()=>0);
 if(pay){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['collab']);s=applyAction(s,0,{type:'choose',zone:'collab'},pool,()=>0);}
 assert.equal(s.players[0].zones.collab.damage,pay?10:40);
 assert.equal(s.players[0].zones.center.damage,40);
 assert.equal(s.players[0].archive.some(c=>c.id==='cost'),pay);
 assert.equal(s.pendingChoice,null);
});
