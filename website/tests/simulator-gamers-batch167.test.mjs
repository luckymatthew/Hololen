import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
test('0725 required Gamers archive cheer',()=>{
 let s=state('hBP07-025');fund(s.players[0].zones.center,['無色']);s.players[0].zones.back1=unit('AUDIT-DUMMY');s.players[0].archive=[inst('hY01-001','cheer')];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['cheer']},pool,()=>0);assert.deepEqual(s.pendingChoice.options,['center']);
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer[1].id,'cheer');assert.equal(s.pendingChoice,null);
});
