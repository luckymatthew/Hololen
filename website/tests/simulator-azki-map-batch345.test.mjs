import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
for(const move of [true,false])test('AZKi map optional return '+move,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hSD01-009');s.players[0].zones.back2=unit('AUDIT-DUMMY');s.players[0].cheerDeck=[inst('hY01-001','cheer')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.effect,'azkiMapRoll');s=applyAction(s,0,{type:'choose',optionId:'roll'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'back2'},pool,()=>0);
 assert.equal(s.pendingChoice.effect,'azkiMapReturn');s=applyAction(s,0,move?{type:'choose',optionId:'return'}:{type:'choose',skip:true},pool,()=>0);assert.equal(Boolean(s.players[0].zones.collab),!move);assert.equal(s.players[0].zones.back2.cheer.length,1);
});
