import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
for(const [power,occupied] of [[3,false],[2,false],[3,true]])test('Nene forced Collab '+power+' '+occupied,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP07-081');s.players[0].holoPower=Array.from({length:power},(_,i)=>inst('AUDIT-DUMMY','p'+i));s.players[1].zones.back1=unit('AUDIT-DUMMY');if(occupied)s.players[1].zones.collab=unit('AUDIT-DUMMY');
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(power===3&&!occupied){assert.equal(s.pendingChoice.type,'forcedCollab');assert.equal(s.pendingChoice.playerIndex,1);s=applyAction(s,1,{type:'choose',zone:'back1'},pool,()=>0);assert.ok(s.players[1].zones.collab);assert.equal(s.players[1].zones.back1,null);assert.equal(s.players[1].holoPower.length,0);assert.equal(s.players[1].collabTurn,0);}else assert.equal(s.pendingChoice,null);
});
