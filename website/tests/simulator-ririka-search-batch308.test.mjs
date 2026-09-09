import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,attack} from './fixtures/simulator-audit.mjs';
for(const hasRirika of [true,false])test('Ririka accepted SP mandatory searches '+hasRirika,()=>{
 const ririka=cards.find(c=>c.group==='holomem'&&c.jpName==='一条莉々華');
 const food=cards.find(c=>c.jpName==='限界飯');assert.ok(food);
 let s=state('AUDIT-DUMMY',ririka.number);
 s.players[1].zones.center.damage=Number(ririka.hp)-10;
 s.players[1].zones.back1=unit('AUDIT-DUMMY');
 s.players[1].oshi=inst('hBP04-003');s.players[1].holoPower=[inst('AUDIT-DUMMY','hp')];
 s.players[1].mainDeck=[...(hasRirika?[inst(ririka.number,'searchRirika')]:[]),inst(food.number,'food')];
 s=applyAction(s,0,attack,pool,()=>0);
 while(s.pendingChoice?.type==='lifeCheerTarget')s=applyAction(s,1,{type:'choose',zone:'back1'},pool,()=>0);
 assert.equal(s.pendingChoice.effect,'oshiKnockout');
 s=applyAction(s,1,{type:'choose',optionId:'use'},pool,()=>0);
 while(s.pendingChoice?.type==='lifeCheerTarget')s=applyAction(s,1,{type:'choose',zone:'back1'},pool,()=>0);
 for(const id of [...(hasRirika?['searchRirika']:[]),'food']){
  assert.equal(s.pendingChoice.min,1);assert.equal(Boolean(s.pendingChoice.optional),false);
  assert.throws(()=>applyAction(s,1,{type:'choose',skip:true},pool,()=>0));
  s=applyAction(s,1,{type:'choose',cardIds:[id]},pool,()=>0);
  assert.ok(s.players[1].hand.some(c=>c.id===id));
 }
});
