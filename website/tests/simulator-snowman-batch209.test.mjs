import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const available of [true,false])test('0850 mandatory archive cheer '+available,()=>{
 let s=state('hBP08-050');fund(s.players[0].zones.center,['藍']);s.players[0].zones.back1=unit('AUDIT-DUMMY');
 s.players[0].archive=available?[inst('hY01-001','pick')]:[];
 s=applyAction(s,0,attack,pool,()=>0);
 if(available){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);
 s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[0].zones.back1.cheer[0].id,'pick');}
 assert.equal(s.pendingChoice,null);
});
