import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
for(const reveal of [true,false])test('Suisei optional top reveal '+reveal,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hSD03-004');s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst('AUDIT-DUMMY','top'),inst('AUDIT-DUMMY','last')];s.players[0].cheerDeck=[inst('hY01-001','cheer')];s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,true);s=applyAction(s,0,reveal?{type:'choose',optionId:'reveal'}:{type:'choose',skip:true},pool,()=>0);if(reveal){s=applyAction(s,0,{type:'choose',zone:'collab'},pool,()=>0);assert.equal(s.players[0].zones.collab.cheer[0].id,'cheer');}assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),reveal?['last','top']:['top','last']);
});
