import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const count of [5,6,7])test('072 source and collab bonus Cheer '+count,()=>{
 let s=state('hBP03-072');fund(s.players[0].zones.center,Array(count).fill('黃'));s.players[0].zones.collab=unit('AUDIT-DUMMY');
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,count>=6?180:80);
 s=applyAction(s,0,{...attack,sourceZone:'collab'},pool,()=>0);assert.equal(s.players[1].zones.center.damage,count>=6?380:180);
});
