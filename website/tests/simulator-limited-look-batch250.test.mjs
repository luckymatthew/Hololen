import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
for(const available of [true,false])test('Required top-five LIMITED '+available,()=>{
 const limited=cards.find(c=>c.group==='support'&&c.typeCode.endsWith('Limited'));let s=state();s.phase='main';s.players[0].hand=[inst('hSD01-018','play')];s.players[0].mainDeck=[inst(available?limited.number:'AUDIT-DUMMY','pick'),inst('AUDIT-DUMMY','rest')];s=applyAction(s,0,{type:'play',cardId:'play'},pool,()=>0);
 if(available){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);s=applyAction(s,0,{type:'choose',cardIds:['rest']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'pick');}else{s=applyAction(s,0,{type:'choose',cardIds:['rest','pick']},pool,()=>0);assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),['rest','pick']);}
});
