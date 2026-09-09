import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,fund,attack} from './fixtures/simulator-audit.mjs';
test('Okayu mandatory two blue payment',()=>{
 const c=cards.find(c=>c.number==='hSD03-009');let s=state(c.number);fund(s.players[0].zones.center,c.arts[1].cost);s.players[1].zones.back1=unit('AUDIT-DUMMY');s=applyAction(s,0,{...attack,artIndex:1},pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));for(const cheerId of ['cheer0','cheer1'])s=applyAction(s,0,{type:'choose',cheerId},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer.length,2);assert.equal(s.players[1].zones.center.damage,130);assert.equal(s.players[1].zones.back1.damage,30);
});
