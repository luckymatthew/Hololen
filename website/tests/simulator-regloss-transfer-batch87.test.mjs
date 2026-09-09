import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
for(const skip of [false,true])test('048 ReGLOSS back-row transfer skip='+skip,()=>{
 let s=state('hBP03-048');fund(s.players[0].zones.center,['無色','無色']);
 s.players[0].zones.back1=unit('hBP03-048');s.players[0].zones.back2=unit('AUDIT-DUMMY');s.players[0].zones.collab=unit('hBP03-048');
 s=act(s,{...attack,artIndex:1});assert.equal(s.pendingChoice.effect,'genericMoveCheer');
 if(skip)s=act(s,{type:'choose',skip:true});
 else {s=act(s,{type:'choose',cheerId:'cheer0'});assert.deepEqual(s.pendingChoice.options,['back1']);s=act(s,{type:'choose',zone:'back1'});}
 assert.equal(s.players[0].zones.center.cheer.length,skip?2:1);assert.equal(s.players[0].zones.back1.cheer.length,skip?0:1);assert.equal(s.players[1].zones.center.damage,40);
});
