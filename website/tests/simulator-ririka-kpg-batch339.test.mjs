import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const food of [true,false])test('Ririka two-part special damage food '+food,()=>{
 let s=state('hBP04-037');fund(s.players[0].zones.center,['紅','無色','無色']);s.players[1].zones.collab=unit('AUDIT-DUMMY');
 s.players[0].turnEvents={turn:3,supports:food?[cards.find(c=>c.jpName==='限界飯').number]:[],arts:[]};
 s=applyAction(s,0,attack,pool,()=>0);if(food)s=applyAction(s,0,{type:'choose',zone:'collab'},pool,()=>0);
 assert.equal(s.players[1].zones.center.damage,130);assert.equal(s.players[1].zones.collab.damage,food?30:0);
});
test('KPG Bloom rolls exactly once after accepting',()=>{
 const first=cards.find(c=>c.jpName==='一条莉々華'&&c.stage==='1st');let s=state(first.number);s.phase='main';s.players[0].hand=[inst('hBP04-037','bloom')];s.players[1].zones.back1=unit('AUDIT-DUMMY');let rolls=0;
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0.9);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0.9);assert.equal(s.pendingChoice.effect,'ririkaKpgRoll');
 s=applyAction(s,0,{type:'choose',optionId:'roll'},pool,()=>{rolls++;return 0.9;});assert.equal(rolls,1);assert.equal(s.pendingChoice.type,'forcedCollab');
});
