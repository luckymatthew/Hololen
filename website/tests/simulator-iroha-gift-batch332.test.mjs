import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
test('Iroha Gift only offers next-stage hand card for bloomed Iroha',()=>{
 const first=cards.find(c=>c.jpName==='風真いろは'&&c.stage==='1st');let s=state('hBP06-027');fund(s.players[0].zones.center,['綠','無色','無色']);
 s.players[0].zones.back1=unit(first.number,{bloomedTurn:3});s.players[0].hand=[inst(first.number,'wrong'),inst('hBP06-027','next')];s.players[1].zones.center.damage=9990;s.players[1].zones.back1=unit('AUDIT-DUMMY');
 s=applyAction(s,0,attack,pool,()=>0);while(s.pendingChoice?.type==='lifeCheerTarget')s=applyAction(s,1,{type:'choose',zone:'back1'},pool,()=>0);
 assert.equal(s.pendingChoice.effect,'irohaGiftBloom');assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['next']);
 s=applyAction(s,0,{type:'choose',cardIds:['next']},pool,()=>0);while(s.pendingChoice?.type==='lifeCheerTarget')s=applyAction(s,1,{type:'choose',zone:'back1'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);
 assert.equal(s.players[0].zones.back1.stack.at(-1).id,'next');
});


