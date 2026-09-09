import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const pay of [true,false])test('0885 optional payment mandatory recovery '+pay,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP08-085');s.players[0].hand=[inst('hBP08-077','paid')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,true);
 s=applyAction(s,0,pay?{type:'choose',cardIds:['paid']}:{type:'choose',skip:true},pool,()=>0);
 if(pay){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['paid']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'paid');}else assert.equal(s.pendingChoice,null);
});
test('0889 required Justice cheer',()=>{
 let s=state('hBP08-089');fund(s.players[0].zones.center,['黃']);s.players[0].archive=[inst('hY01-001','recover')];s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['recover']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer.length,2);
});
test('0889 paid stack required Popo',()=>{
 const debut=cards.find(c=>c.jpName==='ジジ・ムリン'&&c.stage==='Debut'),popo=cards.find(c=>c.jpName==='Popo');
 let s=state(debut.number);s.phase='main';s.players[0].hand=[inst('hBP08-089','bloom')];s.players[0].mainDeck=[inst(popo.number,'popo')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 s=applyAction(s,0,{type:'choose',cardIds:[s.players[0].zones.center.stack[0].id]},pool,()=>0);
 assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['popo']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.attachments[0].id,'popo');
});
