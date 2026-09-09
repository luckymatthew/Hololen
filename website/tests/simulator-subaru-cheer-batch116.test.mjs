import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const empty of [false,true])test('071 mandatory self Cheer empty='+empty,()=>{
 let s=state('hBP04-071');fund(s.players[0].zones.center,['黃']);s.players[0].cheerDeck=empty?[]:[inst('hY01-001','top'),inst('hY02-001','next')];s=applyAction(s,0,attack,pool,()=>0);
 if(!empty){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['center']);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer[1].id,'top');assert.equal(s.players[0].cheerDeck[0].id,'next');}
 assert.equal(s.pendingChoice,null);assert.equal(s.players[1].zones.center.damage,20);
});
