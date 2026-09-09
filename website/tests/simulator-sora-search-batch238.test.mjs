import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const number of ['hEB01-008','hEB01-009'])for(const available of [true,false])test(number+' mandatory search '+available,()=>{
 const bloom=number==='hEB01-008';const prior=cards.find(c=>c.jpName==='ときのそら'&&c.stage==='Debut');const target=cards.find(c=>bloom?c.jpName==='STAR STAR☆T':c.jpName==='ときのそら'&&c.stage==='2nd');assert.ok(target);
 let s=state(bloom?prior.number:'AUDIT-DUMMY');s.phase='main';s.players[0].mainDeck=[...(bloom?[]:[inst('AUDIT-DUMMY','power')]),inst(available?target.number:'AUDIT-DUMMY','pick')];
 if(bloom){s.players[0].hand=[inst(number,'bloom')];s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}else{s.players[0].zones.back1=unit(number);s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);}
 if(available){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'pick');}else assert.equal(s.pendingChoice,null);
});
