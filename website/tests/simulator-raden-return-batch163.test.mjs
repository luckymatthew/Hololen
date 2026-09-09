import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state} from './fixtures/simulator-audit.mjs';
test('087 required Raden return',()=>{
 let s=state();s.phase='main';s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='儒烏風亭らでん').number);s.players[0].hand=[inst('hBP06-087','event')];s.players[0].cheerDeck=[inst('hY02-001','cost')];s.players[0].archive=[inst('hBP05-029','return'),inst('AUDIT-DUMMY','invalid')];
 s=applyAction(s,0,{type:'play',cardId:'event'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['return']);
 s=applyAction(s,0,{type:'choose',cardIds:['return']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'return');assert.ok(s.players[0].archive.some(c=>c.id==='cost'));assert.equal(s.pendingChoice,null);
});
