import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const accept of [true,false])test('Risu cheer transfers only to Korone '+accept,()=>{let s=state('hBP03-073');fund(s.players[0].zones.center,['無色','無色','無色']);s.players[0].zones.back1=unit('hBP03-065');s.players[0].zones.back2=unit('AUDIT-DUMMY');s=applyAction(s,0,{...attack,artIndex:1},pool,()=>0);assert.equal(s.pendingChoice.optional,true);if(!accept){s=applyAction(s,0,{type:'choose',skip:true},pool,()=>0);assert.equal(s.players[0].zones.center.cheer.length,3);return;}s=applyAction(s,0,{type:'choose',zone:'center',cheerId:'cheer0'},pool,()=>0);assert.deepEqual(s.pendingChoice.options,['back1']);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[0].zones.back1.cheer[0].id,'cheer0');});
