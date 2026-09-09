import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,state} from './fixtures/simulator-audit.mjs';
test('SorAZ required first pick then bottom order',()=>{
 let s=state();s.phase='main';s.players[0].hand=[inst('hBP05-080','event')];
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','draw1'),inst('AUDIT-DUMMY','draw2'),inst('hBP05-059','first'),...['a','b','c','d','tail'].map(id=>inst('AUDIT-DUMMY',id))];
 s=applyAction(s,0,{type:'play',cardId:'event'},pool,()=>0);
 assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.selectableIds,['first']);
 s=applyAction(s,0,{type:'choose',cardIds:['first']},pool,()=>0);
 s=applyAction(s,0,{type:'choose',cardIds:['d','c','b','a']},pool,()=>0);
 assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),['tail','d','c','b','a']);assert.deepEqual(s.players[0].hand.map(c=>c.id),['draw1','draw2','first']);assert.equal(s.pendingChoice,null);
});
