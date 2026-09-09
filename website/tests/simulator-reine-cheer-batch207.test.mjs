import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
test('0833 both archive cheers one Reine',()=>{
 let s=state('hBP08-033');fund(s.players[0].zones.center,['綠','無色','無色']);s.players[0].zones.back1=unit('hBP08-030');
 s.players[0].archive=[inst('hY01-001','a'),inst('hY01-001','b')];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.optional,false);
 s=applyAction(s,0,{type:'choose',cardIds:['a','b']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);
 assert.equal(s.players[0].zones.back1.cheer.length,2);assert.equal(s.pendingChoice,null);
});
test('0833 required ID cheer search',()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP08-033');s.players[0].cheerDeck=[inst('hY01-001','pick')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);
 s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);assert.deepEqual(s.pendingChoice.options,['collab']);
 s=applyAction(s,0,{type:'choose',zone:'collab'},pool,()=>0);assert.equal(s.players[0].zones.collab.cheer[0].id,'pick');
});
