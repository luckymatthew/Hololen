import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const assistants of [0,2])test('Koyori 024 yellow Oshi assistant reveal '+assistants,()=>{
 let s=state('hEB01-024');s.players[0].oshi=inst('hEB01-003');fund(s.players[0].zones.center,['黃','白','白']);s.players[0].zones.center.damage=100;s.players[0].zones.center.attachments=Array.from({length:assistants},(_,i)=>inst('hBP04-105','fan'+i));s.players[0].mainDeck=Array.from({length:7},(_,i)=>inst('AUDIT-DUMMY','deck'+i));s=applyAction(s,0,attack,pool,()=>0);
 s=applyAction(s,0,{type:'choose',allocations:{center:3+assistants}},pool,()=>0);
 assert.equal(s.players[0].zones.center.damage,Math.max(0,40-assistants*20));assert.equal(s.players[1].zones.center.damage,180+assistants*20);assert.equal(s.pendingChoice,null);assert.equal(s.players[0].mainDeck.length,7);
});

