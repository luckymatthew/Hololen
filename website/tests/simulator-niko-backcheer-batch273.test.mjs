import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
for(const accept of [true,false])test('Niko archive cheer back-only '+accept,()=>{let s=state('hSD11-005');s.phase='main';s.players[0].zones.back1=unit('hSD11-005');s.players[0].zones.back2=unit('hSD11-005');s.players[0].zones.back3=unit('AUDIT-DUMMY');s.players[0].archive=[inst('hY01-001','cheer')];s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,true);s=applyAction(s,0,{type:'choose',cardIds:accept?['cheer']:[]},pool,()=>0);if(accept){assert.deepEqual(s.pendingChoice.options,['back2']);s=applyAction(s,0,{type:'choose',zone:'back2'},pool,()=>0);assert.equal(s.players[0].zones.back2.cheer[0].id,'cheer');}else assert.ok(s.players[0].archive.some(c=>c.id==='cheer'));});
