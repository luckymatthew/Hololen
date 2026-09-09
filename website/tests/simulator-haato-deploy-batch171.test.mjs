import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
for(const count of [1,2])test('0736 required deployment '+count,()=>{
 const c=cards.find(c=>c.jpName==='赤井はあと'&&c.stage==='Debut');
 let s=state();s.phase='main';s.firstPlayer=1;s.players[0].turnsTaken=1;s.players[0].zones.back1=unit('hBP07-036');s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),...Array.from({length:count},(_,i)=>inst(c.number,'valid'+i))];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,count);
 s=applyAction(s,0,{type:'choose',cardIds:Array.from({length:count},(_,i)=>'valid'+i)},pool,()=>0);
 for(let i=0;i<count;i++)s=applyAction(s,0,{type:'choose',zone:'back'+(i+1)},pool,()=>0);
 assert.equal(s.pendingChoice,null);for(let i=0;i<count;i++)assert.equal(s.players[0].zones['back'+(i+1)].stack[0].id,'valid'+i);
});
