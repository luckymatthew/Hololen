import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const assistants of [0,2])test('Koyori 020 reveal only actual Cheer '+assistants,()=>{
 let s=state('hEB01-020');s.players[0].oshi=inst('hEB01-003');fund(s.players[0].zones.center,['黃','白']);s.players[0].zones.center.attachments=Array.from({length:assistants},(_,i)=>inst('hBP04-105','fan'+i));s.players[0].mainDeck=Array.from({length:6},(_,i)=>inst('AUDIT-DUMMY','deck'+i));s=applyAction(s,0,{...attack,artIndex:1},pool,()=>0);assert.equal(s.players[1].zones.center.damage,70);assert.equal(s.players[0].mainDeck.length,6);
});
