import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const hand of [1,6])test('Surging Exhaust ordered Cheer and draw-to '+hand,()=>{
 let s=state('hBP07-035');fund(s.players[0].zones.center,['綠','綠','無色','無色']);s.players[0].hand=Array.from({length:hand},(_,i)=>inst('AUDIT-DUMMY','hand'+i));s.players[0].cheerDeck=[inst('hY01-001','existing')];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.effect,'surgingCheerBottom');assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));
 const order=['cheer3','cheer1','cheer0','cheer2'];s=applyAction(s,0,{type:'choose',cardIds:order},pool,()=>0);assert.deepEqual(s.players[0].cheerDeck.map(c=>c.id),['existing',...order]);assert.equal(s.players[0].hand.length,Math.max(hand,4));assert.equal(s.players[0].zones.center.cheer.length,0);assert.equal(s.players[1].zones.center.damage,160);
});
