import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
for(const name of ['角巻わため','大空スバル'])test('083 return '+name,()=>{
 const target=cards.find(c=>c.group==='holomem'&&c.jpName===name),subaru=cards.find(c=>c.group==='holomem'&&c.jpName==='大空スバル');
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP06-083');s.players[0].hand=[inst(subaru.number,'cost')];s.players[0].archive=[inst(target.number,'return'),inst('AUDIT-DUMMY','invalid')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,true);s=applyAction(s,0,{type:'choose',cardIds:['cost']},pool,()=>0);
 assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['return']);s=applyAction(s,0,{type:'choose',cardIds:['return']},pool,()=>0);
 assert.equal(s.players[0].hand[0].id,'return');assert.equal(s.players[0].mainDeck.at(-1).id,'cost');assert.equal(s.pendingChoice,null);
});
