import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,state} from './fixtures/simulator-audit.mjs';
for(const mode of ['skip','odd','even'])test('058 exactly three optional dice '+mode,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP04-058');const rng=()=>mode==='even'?0.25:0;
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,rng);assert.equal(s.players[0].turnEvents.diceRollCount||0,0);s=applyAction(s,0,mode==='skip'?{type:'choose',skip:true}:{type:'choose',optionId:'roll'},pool,rng);
 assert.equal(s.players[0].turnEvents.diceRollCount||0,mode==='skip'?0:3);assert.equal(s.players[1].zones.center.damage,mode==='odd'?30:0);
});
