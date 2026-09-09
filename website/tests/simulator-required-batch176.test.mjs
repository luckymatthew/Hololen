import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const valid of [true,false])test('0770 required cooking top look '+valid,()=>{
 const c=cards.find(c=>c.number==='hBP07-070'),prior=cards.find(x=>x.jpName===c.jpName&&x.stage==='Debut');
 const pick=cards.find(x=>x.group==='holomem'&&x.tags.includes('#料理'));
 let s=state(prior.number);s.phase='main';s.players[0].hand=[inst(c.number,'bloom')];s.players[0].mainDeck=[inst(valid?pick.number:'AUDIT-DUMMY','pick'),inst('AUDIT-DUMMY','a'),inst('AUDIT-DUMMY','b'),inst('AUDIT-DUMMY','tail')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 if(valid){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.selectableIds,['pick']);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);}
 s=applyAction(s,0,{type:'choose',cardIds:valid?['b','a']:['b','a','pick']},pool,()=>0);assert.equal(s.players[0].hand.length,valid?1:0);assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),valid?['tail','b','a']:['tail','b','a','pick']);
});
for(const [first,turns] of [[1,1],[0,1],[1,2]])test('0759 recovery turn gate '+first+turns,()=>{
 let s=state();s.phase='main';s.firstPlayer=first;s.players[0].turnsTaken=turns;s.players[0].zones.back1=unit('hBP07-059');
 s.players[0].archive=[inst(cards.find(c=>c.group==='support').number,'support'),inst('AUDIT-DUMMY','other')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(first===1&&turns===1){
 assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['support']},pool,()=>0);assert.equal(s.players[0].hand.at(-1).id,'support');
 }else assert.equal(s.pendingChoice,null);
});
