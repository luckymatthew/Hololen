import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
for(const timing of ['eligible','first','later'])test('Okayu search '+timing,()=>{
 let s=state();s.phase='main';s.firstPlayer=timing==='first'?0:1;s.players[0].turnsTaken=timing==='later'?2:1;s.players[0].zones.back1=unit('hBP05-042');
 const c=cards.find(c=>c.stage==='2nd'&&c.tags.includes('#ゲーマーズ'));s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(c.number,'valid'),inst('hBP05-042','invalid')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(timing==='eligible'){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['valid']);s=applyAction(s,0,{type:'choose',cardIds:['valid']},pool,()=>0);}
 assert.equal(s.players[0].hand.length,timing==='eligible'?1:0);assert.equal(s.pendingChoice,null);
});
test('Lamy required Yukimin search',()=>{
 const prior=cards.find(c=>c.jpName==='雪花ラミィ'&&c.stage==='Debut');const fan=cards.find(c=>c.jpName==='雪民'||c.name==='雪民');
 let s=state(prior.number);s.phase='main';s.players[0].hand=[inst('hBP05-046','bloom')];s.players[0].mainDeck=[inst(fan.number,'fan'),inst('AUDIT-DUMMY','invalid')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['fan']);s=applyAction(s,0,{type:'choose',cardIds:['fan']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'fan');assert.equal(s.pendingChoice,null);
});
