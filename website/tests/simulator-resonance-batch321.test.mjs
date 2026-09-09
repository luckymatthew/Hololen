import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const count of [1,3])test('Resonance Roar top archive '+count,()=>{
 let s=state('hBP06-020');fund(s.players[0].zones.center,['白','無色','無色']);
 const top=s.players[0].mainDeck.slice(0,count).map(c=>c.id);
 s=applyAction(s,0,attack,pool,()=>0);
 assert.equal(s.pendingChoice.optional,false);assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));
 s=applyAction(s,0,{type:'choose',optionId:String(count)},pool,()=>0);
 assert.equal(s.players[1].zones.center.damage,150+count*20);
 assert.deepEqual(s.players[0].archive.map(c=>c.id),top);
});
