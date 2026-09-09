import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
test('Choco excludes LIMITED event recovery',()=>{
 const prior=cards.find(c=>c.jpName==='癒月ちょこ'&&c.stage==='Debut'),event=cards.find(c=>c.typeCode==='supportEvent'),limited=cards.find(c=>c.typeCode==='supportEventLimited');let s=state(prior.number);s.phase='main';s.players[0].hand=[inst('hSD04-007','bloom')];s.players[0].archive=[inst(event.number,'yes'),inst(limited.number,'no')];s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['yes']);assert.equal(s.pendingChoice.optional,true);
});
test('Choco required back-only heal',()=>{
 let s=state('hSD04-007');fund(s.players[0].zones.center,['白','白']);s.players[0].zones.center.damage=30;s.players[0].zones.back1=unit('AUDIT-DUMMY',{damage:30});s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['back1']);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[0].zones.back1.damage,10);assert.equal(s.players[0].zones.center.damage,30);
});
