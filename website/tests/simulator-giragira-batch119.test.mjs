import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const count of [0,1,5,6])test('086 archive Cheer cap '+count,()=>{
 const s=state('hBP04-086');fund(s.players[0].zones.center,['藍','黃']);s.players[0].archive=[inst('AUDIT-DUMMY','other'),...Array.from({length:count},(_,i)=>inst('hY01-001','cheer'+i))];s.players[1].archive=[inst('hY01-001','enemy')];
 assert.equal(applyAction(s,0,{...attack,artIndex:1},pool,()=>0).players[1].zones.center.damage,50+Math.min(5,count)*20);
});
