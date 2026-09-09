import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const available of [true,false])test('0773 required Laplus search '+available,()=>{
 let s=state('hBP07-073');fund(s.players[0].zones.center,['無色','無色']);
 s.players[0].mainDeck=available?[inst('hBP07-071','pick'),inst('AUDIT-DUMMY','other')]:[inst('AUDIT-DUMMY','other')];
 s=applyAction(s,0,attack,pool,()=>0);
 if(available){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);assert.equal(s.players[0].hand.at(-1).id,'pick');}
 else assert.equal(s.pendingChoice,null);
 assert.equal(s.players[0].mainDeck.length,1);
});
