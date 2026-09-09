import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const [first,turns,count] of [[1,1,2],[1,1,1],[0,1,2],[1,2,2]])test('0821 two Otomo '+first+turns+count,()=>{
 let s=state();s.phase='main';s.firstPlayer=first;s.players[0].turnsTaken=turns;s.players[0].zones.back1=unit('hBP08-021');
 const c=cards.find(c=>c.jpName==='Otomo'||c.name==='Otomo');
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),...Array.from({length:count},(_,i)=>inst(c.number,'pick'+i))];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(first===1&&turns===1){
 assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,count);
 s=applyAction(s,0,{type:'choose',cardIds:Array.from({length:count},(_,i)=>'pick'+i)},pool,()=>0);assert.equal(s.players[0].hand.length,count);
 }else assert.equal(s.pendingChoice,null);
});
