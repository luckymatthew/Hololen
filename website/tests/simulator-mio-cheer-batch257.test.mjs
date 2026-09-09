import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
for(const pay of [true,false])test('Mio paid required Debut Cheer '+pay,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hSD02-011');s.players[0].hand=[inst('AUDIT-DUMMY','pay')];s.players[0].cheerDeck=[inst('hY01-001','top')];s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);s=applyAction(s,0,pay?{type:'choose',cardIds:['pay']}:{type:'choose',skip:true},pool,()=>0);if(pay){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['center']);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer[0].id,'top');}else assert.equal(s.players[0].cheerDeck.length,1);
});
