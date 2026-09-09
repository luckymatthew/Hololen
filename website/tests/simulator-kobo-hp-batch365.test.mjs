import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const [back,damaged] of [[3,true],[3,false],[2,true]])test('Kobo local HP and back count '+back+' '+damaged,()=>{
 let s=state('hBP07-058');fund(s.players[0].zones.center,['藍','無色','無色']);for(let i=1;i<=back;i++)s.players[1].zones['back'+i]=unit('AUDIT-DUMMY');s.players[1].zones.center.damage=damaged?10:0;
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[0].hand.length,back===3&&damaged?2:0);
});
