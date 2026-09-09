import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const pay of [true,false])test('0830 optional cost required back cheer '+pay,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP08-030');s.players[0].zones.back2=unit('AUDIT-DUMMY');
 s.players[0].hand=[inst('hBP08-030','cost')];s.players[0].cheerDeck=[inst('hY01-001','top')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,true);
 s=applyAction(s,0,pay?{type:'choose',cardIds:['cost']}:{type:'choose',skip:true},pool,()=>0);
 if(pay){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['back2']);s=applyAction(s,0,{type:'choose',zone:'back2'},pool,()=>0);}
 assert.equal(s.players[0].zones.back2.cheer.length,pay?1:0);assert.equal(s.players[0].archive.some(c=>c.id==='cost'),pay);
});
