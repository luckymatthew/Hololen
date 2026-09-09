import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state} from './fixtures/simulator-audit.mjs';
for(const valid of [true,false])test('051 top look valid '+valid,()=>{
 const c=cards.find(c=>c.number==='hBP05-051'),prior=cards.find(x=>x.jpName===c.jpName&&x.stage==='Debut');
 const pick=cards.find(x=>x.group==='holomem'&&x.tags.includes('#お酒'));
 let s=state(prior.number);s.phase='main';s.players[0].hand=[inst(c.number,'bloom')];s.players[0].mainDeck=[inst(valid?pick.number:'AUDIT-DUMMY','pick'),inst('AUDIT-DUMMY','a'),inst('AUDIT-DUMMY','b'),inst('AUDIT-DUMMY','tail')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 if(valid){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.selectableIds,['pick']);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);}
 s=applyAction(s,0,{type:'choose',cardIds:valid?['b','a']:['b','a','pick']},pool,()=>0);assert.equal(s.players[0].hand.length,valid?1:0);assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),valid?['tail','b','a']:['tail','b','a','pick']);
});
