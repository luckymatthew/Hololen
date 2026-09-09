import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
for(const count of [1,3])test('Sora required deployment count '+count,()=>{
 const debut=cards.find(c=>c.jpName==='ときのそら'&&c.stage==='Debut'&&c.unlimited);assert.ok(debut);let s=state();s.phase='main';s.firstPlayer=1;s.players[0].turnsTaken=1;s.players[0].zones.back1=unit('hEB01-005');s.players[0].hand=[inst('AUDIT-DUMMY','bottom')];s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),...Array.from({length:3},(_,i)=>inst(debut.number,'s'+i))];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,1);assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));
 s=applyAction(s,0,{type:'choose',cardIds:Array.from({length:count},(_,i)=>'s'+i)},pool,()=>0);for(let i=0;i<count;i++)s=applyAction(s,0,{type:'choose',zone:'back'+(i+1)},pool,()=>0);
 if(count===3){s=applyAction(s,0,{type:'choose',cardIds:['bottom']},pool,()=>0);assert.equal(s.players[0].mainDeck.at(-1).id,'bottom');}else assert.equal(s.players[0].hand[0].id,'bottom');
});
