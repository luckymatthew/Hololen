import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
test('multilingual cheer locks color and recipient after back selection',()=>{
 const member=cards.find(c=>c.group==='holomem'&&c.tags?.includes('#語学')&&c.colors?.includes('紫'));
 let s=state('hBP04-031');fund(s.players[0].zones.center,['綠','無色']);s.players[0].zones.back1=unit(member.number);s.players[0].zones.back2=unit('AUDIT-DUMMY');s.players[0].cheerDeck=[inst('hY05-001','blue'),inst('hY01-001','white')];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.effect,'multilingualCheer');s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);
 assert.throws(()=>applyAction(s,0,{type:'choose',cardIds:['white']},pool,()=>0));s=applyAction(s,0,{type:'choose',cardIds:['blue']},pool,()=>0);
 assert.throws(()=>applyAction(s,0,{type:'choose',zone:'back2'},pool,()=>0));s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[0].zones.back1.cheer[0].id,'blue');
});

