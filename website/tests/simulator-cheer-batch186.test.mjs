import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
test('0784 required archive cheer',()=>{
 let s=state('hBP07-084');fund(s.players[0].zones.center,['黃','無色']);s.players[0].archive=[inst('hY01-001','cheer')];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.optional,false);
 s=applyAction(s,0,{type:'choose',cardIds:['cheer']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.players[0].zones.center.cheer.at(-1).id,'cheer');
});
for(const [turn,count] of [[3,0],[3,1],[3,2],[2,1]])test('0788 current turn archive gate '+turn+count,()=>{
 let s=state('hBP07-088');fund(s.players[0].zones.center,['黃','無色']);s.players[0].turnEvents={turn,supports:[],arts:[],cheerArchived:count};
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,turn===3&&count>0?80:50);
});
