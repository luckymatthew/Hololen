import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state} from './fixtures/simulator-audit.mjs';
for(const count of [1,2,3])test('093 required search count '+count,()=>{
 const c=cards.find(c=>c.group==='holomem'&&c.tags.includes('#秘密結社holoX'));
 let s=state(c.number);s.phase='main';s.players[0].hand=[inst('hBP06-093','event')];s.players[0].mainDeck=[...Array.from({length:count},(_,i)=>inst(c.number,'valid'+i)),inst('AUDIT-DUMMY','invalid')];
 s=applyAction(s,0,{type:'play',cardId:'event'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,Math.min(2,count));
 s=applyAction(s,0,{type:'choose',cardIds:Array.from({length:Math.min(2,count)},(_,i)=>'valid'+i)},pool,()=>0);assert.equal(s.players[0].hand.length,Math.min(2,count));assert.equal(s.pendingChoice,null);
});
