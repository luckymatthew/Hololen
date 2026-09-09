import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
test('AZKi Oshi required event search',()=>{
 let s=state();s.phase='main';s.players[0].oshi=inst('hBP07-006');s.players[0].holoPower=[inst('AUDIT-DUMMY','power')];s.knockouts=[{turn:2,ownerIndex:0,sourcePlayerIndex:1}];const event=cards.find(c=>c.typeCode==='supportEvent');s.players[0].mainDeck=[inst(event.number,'event'),inst('AUDIT-DUMMY','other')];s=applyAction(s,0,{type:'oshiSkill'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));s=applyAction(s,0,{type:'choose',cardIds:['event']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'event');assert.equal(s.players[0].holoPower.length,0);
});
