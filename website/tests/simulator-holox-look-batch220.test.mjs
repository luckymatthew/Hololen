import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const available of [true,false])test('0863 required holoX top look '+available,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP08-063');
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(available?'hBP08-063':'AUDIT-DUMMY','pick'),...['a','b','tail'].map(id=>inst('AUDIT-DUMMY',id))];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(available){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.selectableIds,['pick']);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);}
 s=applyAction(s,0,{type:'choose',cardIds:available?['b','a']:['b','a','pick']},pool,()=>0);
 assert.equal(s.players[0].hand.length,available?1:0);assert.equal(s.players[0].mainDeck[0].id,'tail');
});
