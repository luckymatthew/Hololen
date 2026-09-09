import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const count of [1,2,3])test('0844 archive selected top count '+count,()=>{
 let s=state('hBP08-044');fund(s.players[0].zones.center,['紅','紅']);s.players[0].mainDeck=['a','b','c','d'].map(id=>inst('AUDIT-DUMMY',id));
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.optional,false);
 s=applyAction(s,0,{type:'choose',optionId:String(count)},pool,()=>0);
 assert.deepEqual(s.players[0].archive.map(c=>c.id),['a','b','c'].slice(0,count));assert.equal(s.players[0].turnEvents.deckArchived,count);
});
