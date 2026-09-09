import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const pick of ['a','b'])test('062 archive chosen top card '+pick,()=>{
 let s=state('hBP04-062');fund(s.players[0].zones.center,['紫','無色']);s.players[0].mainDeck=['a','b','tail'].map(id=>inst('AUDIT-DUMMY',id));s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:[pick]},pool,()=>0);assert.equal(s.players[0].archive[0].id,pick);assert.equal(s.players[0].hand.length,0);assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),[pick==='a'?'b':'a','tail']);assert.equal(s.players[1].zones.center.damage,50);
});
for(const loseLife of [true,false])test('062 Buzz printed life loss '+loseLife,()=>{
 const s=state();s.players[1].zones.back1=unit('hBP04-062',{damage:10000});
 s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'back1',sourceZone:'center',amount:10,loseLife,sourceName:'test'}];
 const next=applyAction(s,0,attack,pool,()=>.5);assert.equal(next.players[1].zones.back1,null);assert.equal(next.players[1].life.length,loseLife?3:5);assert.ok(next.players[1].archive.some(c=>c.number==='hBP04-062'));
});

