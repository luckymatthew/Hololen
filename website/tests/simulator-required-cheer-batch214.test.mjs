import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
test('0851 required Su cheer',()=>{
 let s=state('hBP08-051');fund(s.players[0].zones.center,['藍','無色']);s.players[0].zones.back1=unit('AUDIT-DUMMY');s.players[0].cheerDeck=[inst('hY01-001','top')];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['center']);
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer.at(-1).id,'top');
});
test('0855 required Advent archive cheer',()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP08-055');s.players[0].archive=[inst('hY01-001','pick')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);
 s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);assert.deepEqual(s.pendingChoice.options,['collab']);
 s=applyAction(s,0,{type:'choose',zone:'collab'},pool,()=>0);assert.equal(s.players[0].zones.collab.cheer[0].id,'pick');
});
