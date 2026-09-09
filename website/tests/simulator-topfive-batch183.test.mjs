import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const n of ['hBP07-071','hBP07-078'])for(const valid of [true,false])test(n+' required top-five selection '+valid,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit(n);
 const pick=n==='hBP07-071'?'hBP07-071':cards.find(c=>c.jpName==='ねっ子'||c.name==='ねっ子').number;
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(valid?pick:'AUDIT-DUMMY','pick'),...['a','b','c','d','tail'].map(id=>inst('AUDIT-DUMMY',id))];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(valid){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.selectableIds,['pick']);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);}
 s=applyAction(s,0,{type:'choose',cardIds:valid?['d','c','b','a']:['d','c','b','a','pick']},pool,()=>0);
 assert.equal(s.players[0].hand.length,valid?1:0);
 assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),valid?['tail','d','c','b','a']:['tail','d','c','b','a','pick']);
});
