import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,attack} from './fixtures/simulator-audit.mjs';
test('Roboco knockout recovery is mandatory after accepting skill',()=>{
 const robo=cards.find(c=>c.group==='holomem'&&c.jpName==='ロボ子さん');
 let s=state('AUDIT-DUMMY',robo.number);
 s.players[1].zones.center.damage=Number(robo.hp)-10;
 s.players[1].zones.back1=unit('AUDIT-DUMMY');
 s.players[1].oshi=inst('hBP06-007');s.players[1].archive=[inst(robo.number,robo.number)];
 s.players[1].holoPower=Array.from({length:5},(_,i)=>inst('AUDIT-DUMMY','hp'+i));
 s=applyAction(s,0,attack,pool,()=>0);
 for(let i=0;i<5&&s.pendingChoice?.effect!=='oshiKnockout';i++){
  assert.equal(s.pendingChoice?.type,'lifeCheerTarget');
  s=applyAction(s,1,{type:'choose',zone:'back1'},pool,()=>0);
 }
 assert.equal(s.pendingChoice?.effect,'oshiKnockout');
 s=applyAction(s,1,{type:'choose',optionId:'use'},pool,()=>0);
 while(s.pendingChoice?.type==="lifeCheerTarget") s=applyAction(s,1,{type:"choose",zone:"back1"},pool,()=>0);
 assert.equal(Boolean(s.pendingChoice.optional),false);
 assert.equal(s.pendingChoice.min,1);
 assert.throws(()=>applyAction(s,1,{type:'choose',skip:true},pool,()=>0));
 s=applyAction(s,1,{type:'choose',cardIds:[robo.number]},pool,()=>0);
 assert.ok(s.players[1].hand.some(c=>c.number===robo.number));
});

