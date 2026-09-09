import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const [turn,count] of [[3,0],[3,2],[3,3],[3,4],[2,3]])test('0820 deck archive threshold '+turn+count,()=>{
 let s=state('hBP08-020');fund(s.players[0].zones.center,['白','無色']);s.players[0].turnEvents={turn,supports:[],arts:[],deckArchived:count};
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,turn===3&&count>=3?150:110);
});
