import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const count of [3,4,5])test('053 cheer threshold '+count,()=>{
 let s=state('hBP06-053');fund(s.players[0].zones.center,['藍',...Array(count-1).fill('無色')]);s.players[1].zones.collab=unit('AUDIT-DUMMY');
 s=applyAction(s,0,attack,pool,()=>0);if(count>=4){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['center','collab']);s=applyAction(s,0,{type:'choose',zone:'collab'},pool,()=>0);}
 assert.equal(s.players[1].zones.collab.damage,count>=4?90:0);assert.equal(s.players[1].zones.center.damage,90);assert.equal(s.pendingChoice,null);
});
