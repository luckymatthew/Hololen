import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,state} from './fixtures/simulator-audit.mjs';
for(const die of [0,1,2,3,4,5,6])test('055 optional single roll '+die,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP04-055');s.players[1].zones.back1=unit('AUDIT-DUMMY');const act=a=>{s=applyAction(s,0,a,pool,()=>(die-.5)/6)};
 act({type:'collab',zone:'back1'});assert.equal(s.players[0].turnEvents.diceRollCount||0,0);act(die?{type:'choose',optionId:'roll'}:{type:'choose',skip:true});
 if(die>=3){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['back1']);act({type:'choose',zone:'back1'});}
 assert.equal(s.pendingChoice,null);assert.equal(s.players[0].turnEvents.diceRollCount||0,die?1:0);assert.equal(s.players[1].zones.back1.rested,die>=3);
});
