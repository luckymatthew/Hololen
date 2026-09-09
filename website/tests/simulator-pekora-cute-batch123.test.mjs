import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const die of [0,1,2,3,4,5,6])test('014 optional dice draw '+die,()=>{
 let s=state('hBP05-014');fund(s.players[0].zones.center,['無色']);const act=a=>{s=applyAction(s,0,a,pool,()=>(die-.5)/6)};act(attack);assert.equal(s.players[0].turnEvents.diceRollCount||0,0);act(die?{type:'choose',optionId:'roll'}:{type:'choose',skip:true});assert.equal(s.players[0].hand.length,die&&die%2===0?1:0);assert.equal(s.players[0].turnEvents.diceRollCount||0,die?1:0);assert.equal(s.players[1].zones.center.damage,20);
});
