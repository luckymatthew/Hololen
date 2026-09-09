import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
for(const skip of [true,false])test('Subaru Smile optional deployment '+skip,()=>{
 let s=state('hSD19-004');s.phase='main';s.firstPlayer=1;s.players[0].turnsTaken=1;s.players[0].zones.back1=unit('hSD19-004');s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst('AUDIT-DUMMY','debut')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,true);
 s=applyAction(s,0,skip?{type:'choose',skip:true}:{type:'choose',cardIds:['debut']},pool,()=>0);
 if(!skip)s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);
 assert.equal(Boolean(s.players[0].zones.back1),!skip);assert.equal(s.players[0].mainDeck.length,skip?1:0);
});
