import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const available of [true,false])test('0875 mandatory Robosa search '+available,()=>{
 const prior=cards.find(c=>c.jpName==='ロボ子さん'&&c.stage==='1st');
 const fan=cards.find(c=>c.jpName==='ろぼさー');
 let s=state(prior.number);s.phase='main';s.players[0].hand=[inst('hBP08-075','bloom')];
 s.players[0].mainDeck=[inst(available?fan.number:'AUDIT-DUMMY','pick')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 if(available){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'pick');}
 else assert.equal(s.pendingChoice,null);
});
