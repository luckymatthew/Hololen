import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,attack} from './fixtures/simulator-audit.mjs';
for(const nonGreen of [0,1,2,3])test('Iroha counts non-green Cheer '+nonGreen,()=>{
 const s=state('hBP03-024');s.players[0].zones.center.cheer=Array.from({length:4},(_,i)=>inst(i<nonGreen?'hY01-001':'hY02-001','cheer'+i));
 const e=applyAction(s,0,attack,pool,()=>0);assert.equal(e.players[1].zones.center.damage,nonGreen>=2?150:100);
});
