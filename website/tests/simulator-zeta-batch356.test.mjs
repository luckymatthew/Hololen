import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,attack} from './fixtures/simulator-audit.mjs';
test('Zeta Buzz required deck attachment',()=>{
 const first=cards.find(c=>c.jpName==='ベスティア・ゼータ'&&c.stage==='Debut');const fan=cards.find(c=>c.jpName==='BAZO');let s=state(first.number);s.phase='main';s.players[0].hand=[inst('hBP07-019','bloom')];s.players[0].mainDeck=[inst(fan.number,'fan')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));s=applyAction(s,0,{type:'choose',cardIds:['fan']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.attachments[0].id,'fan');
});
test('Zeta Buzz DOWN loses exactly two life',()=>{
 let s=state('AUDIT-DUMMY','hBP07-019');s.players[1].zones.center.damage=cards.find(c=>c.number==='hBP07-019').hp-10;s.players[1].zones.back1=unit('AUDIT-DUMMY');s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].life.length,3);
});
