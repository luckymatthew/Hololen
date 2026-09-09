import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const available of [true,false])test('0779 required mascot attachment '+available,()=>{
 let s=state('hBP07-079');fund(s.players[0].zones.center,['無色']);s.players[0].zones.back1=unit('AUDIT-DUMMY');
 s.players[0].mainDeck=available?[inst('hBP04-102','mascot'),inst('AUDIT-DUMMY','other')]:[inst('AUDIT-DUMMY','other')];
 s=applyAction(s,0,attack,pool,()=>0);
 if(available){
 assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['mascot']},pool,()=>0);
 assert.deepEqual(s.pendingChoice.options,['center','back1']);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);
 assert.equal(s.players[0].zones.back1.attachments.at(-1).id,'mascot');
 }else assert.equal(s.pendingChoice,null);
});
