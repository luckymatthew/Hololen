import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state} from './fixtures/simulator-audit.mjs';
for(const rested of [true,false])test('Otomo may retain state '+rested,()=>{
 const c=cards.find(c=>c.jpName==='セシリア・イマーグリーン'&&c.group==='holomem');let s=state(c.number);s.phase='main';s.players[0].zones.center.rested=rested;s.players[0].hand=[inst('hBP08-107','fan')];
 s=applyAction(s,0,{type:'play',cardId:'fan'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.pendingChoice.optional,true);s=applyAction(s,0,{type:'choose',skip:true},pool,()=>0);assert.equal(s.players[0].zones.center.rested,rested);
});
test('Chocola required cheer after heal',()=>{
 let s=state();s.phase='main';s.players[0].zones.center.damage=50;s.players[0].hand=[inst('hBP08-097','play')];s.players[0].archive=[inst('hBP08-097','food'),inst('hY01-001','cheer')];
 s=applyAction(s,0,{type:'play',cardId:'play'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.damage,30);assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['cheer']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer[0].id,'cheer');
});
