import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const die of [0,1,2,3])test('AZKi optional die '+die,()=>{
 const card=cards.find(c=>c.number==='hSD01-011');let s=state(card.number);fund(s.players[0].zones.center,card.arts[1].cost);s=applyAction(s,0,{...attack,artIndex:1},pool,()=>Math.max(0,die-1)/6);assert.equal(s.pendingChoice.optional,true);s=applyAction(s,0,die?{type:'choose',optionId:'roll'}:{type:'choose',skip:true},pool,()=>Math.max(0,die-1)/6);assert.equal(s.players[1].zones.center.damage,Number(card.arts[1].damage)+(die===1?100:die===3?50:0));
});
test('AZKi Sora-gated required top Cheer',()=>{
 const card=cards.find(c=>c.number==='hSD01-011'),sora=cards.find(c=>c.jpName==='ときのそら'&&c.stage==='Debut');let s=state(card.number);fund(s.players[0].zones.center,card.arts[0].cost);s.players[0].zones.back1=unit(sora.number);s.players[0].cheerDeck=[inst('hY01-001','top')];s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.ok(s.players[0].zones.center.cheer.some(c=>c.id==='top'));
});
