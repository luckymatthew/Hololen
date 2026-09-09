import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,fund} from './fixtures/simulator-audit.mjs';
for(const skip of [true,false])test('Violet Domination opponent transfer '+skip,()=>{
 const card=cards.find(c=>c.number==='hBP08-067');const first=cards.find(c=>c.jpName===card.jpName&&c.stage==='1st');let s=state(first.number);s.phase='main';s.players[0].hand=[inst(card.number,'bloom'),inst('AUDIT-DUMMY','pay1'),inst('AUDIT-DUMMY','pay2')];s.players[1].zones.back1=unit('AUDIT-DUMMY');fund(s.players[1].zones.center,['紫']);fund(s.players[0].zones.center,['白']);
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 s=applyAction(s,0,skip?{type:'choose',skip:true}:{type:'choose',cardIds:['pay1','pay2']},pool,()=>0);
 if(skip){assert.equal(s.players[0].hand.length,2);assert.equal(s.players[1].zones.center.cheer.length,1);return;}
 assert.equal(s.pendingChoice.ownerIndex,1);assert.equal(s.pendingChoice.optional,false);assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));
 s=applyAction(s,0,{type:'choose',zone:'center',cheerId:'cheer0'},pool,()=>0);assert.equal(s.pendingChoice.targetPlayerIndex,1);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);
 assert.equal(s.players[1].zones.center.cheer.length,0);assert.equal(s.players[1].zones.back1.cheer.length,1);assert.equal(s.players[0].zones.center.cheer.length,1);assert.equal(s.players[0].archive.length,2);
});
