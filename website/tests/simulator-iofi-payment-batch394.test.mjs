import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,fund} from './fixtures/simulator-audit.mjs';
test('Iofi SP requires second Cheer before deck search',()=>{
 let s=state();s.phase='main';s.players[0].oshi=inst('hBP05-002');s.players[0].holoPower=Array.from({length:3},(_,i)=>inst('AUDIT-DUMMY','p'+i));fund(s.players[0].zones.center,['藍','藍']);s.players[0].mainDeck=[inst('hBP05-016','x')];
 const id1=pool.find(c=>c.group==='holomem'&&c.tags?.includes('#ID1期生'));s.players[0].mainDeck=[inst(id1.number,'a'),inst(id1.number,'b')];
 s=applyAction(s,0,{type:'spOshiSkill'},pool,()=>0);s=applyAction(s,0,{type:'choose',cheerId:'cheer0'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool));s=applyAction(s,0,{type:'choose',cheerId:'cheer1'},pool,()=>0);assert.equal(s.pendingChoice.effect,'deckToHandShuffle');assert.equal(s.players[0].zones.center.cheer.length,0);
});
