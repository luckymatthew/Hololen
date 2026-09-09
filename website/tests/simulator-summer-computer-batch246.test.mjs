import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
for(const life of [1,2])test('Summer computer required mode life '+life,()=>{
 const target=cards.find(c=>c.group==='holomem'&&c.stage==='Debut'&&c.tags.includes('#サマー'));let s=state();s.phase='main';s.players[0].life=s.players[0].life.slice(0,life);s.players[0].hand=[inst('hEB01-025','play')];s.players[0].mainDeck=[inst(target.number,'pick')];s=applyAction(s,0,{type:'play',cardId:'play'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);if(life===2){s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[0].zones.back1.stack[0].id,'pick');}else assert.equal(s.players[0].hand[0].id,'pick');
});
