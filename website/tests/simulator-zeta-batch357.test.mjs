import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const buzz of [true,false])test('Zeta requires ID3 Buzz '+buzz,()=>{
 let s=state('hBP07-021');fund(s.players[0].zones.center,['白','白','無色','無色']);s.players[0].zones.back1=unit(buzz?'hBP07-019':cards.find(c=>c.tags?.includes('#ID3期生')&&c.stage==='Debut').number);
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,buzz?200:160);
});
test('Zeta mandatory archive attachment',()=>{
 let s=state('hBP07-019');s.phase='main';s.players[0].hand=[inst('hBP07-021','bloom')];const fan=cards.find(c=>c.jpName==='BAZO');s.players[0].archive=[inst(fan.number,'fan')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));s=applyAction(s,0,{type:'choose',cardIds:['fan']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.attachments[0].id,'fan');
});
