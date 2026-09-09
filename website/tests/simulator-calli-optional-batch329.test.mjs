import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const skip of [true,false])test('Calli Bullseye optional cost '+skip,()=>{
 let s=state('hBP06-060');s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='森カリオペ').number);fund(s.players[0].zones.center,['無色']);s.players[0].cheerDeck=[inst('hY01-001','cheer')];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.effect,'calliBullseye');
 s=applyAction(s,0,skip?{type:'choose',skip:true}:{type:'choose',optionId:'use'},pool,()=>0);
 if(!skip)s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.players[0].archive.length,skip?0:2);assert.equal(s.players[0].zones.center.cheer.length,skip?1:2);
});
for(const skip of [true,false])test('Calli Memento optional draw '+skip,()=>{
 let s=state('hBP06-060');s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='森カリオペ').number);fund(s.players[0].zones.center,['無色','無色','無色','無色']);s.players[0].archive=Array.from({length:8},(_,i)=>inst('AUDIT-DUMMY','a'+i));
 s=applyAction(s,0,{...attack,artIndex:1},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.pendingChoice.effect,'calliMementoDraw');const hand=s.players[0].hand.length;
 s=applyAction(s,0,skip?{type:'choose',skip:true}:{type:'choose',optionId:'draw'},pool,()=>0);assert.equal(s.players[0].hand.length,hand+(skip?0:1));
});
