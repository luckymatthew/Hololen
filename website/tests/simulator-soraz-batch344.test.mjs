import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const mode of ['skip','odd','even'])test('SorAZ optional die '+mode,()=>{
 let s=state('hSD01-013');fund(s.players[0].zones.center,['無色','無色']);s.players[0].cheerDeck=[inst('hY01-001','cheer')];s=applyAction(s,0,attack,pool,()=>0);
 assert.equal(s.pendingChoice.effect,'sorazRoll');s=applyAction(s,0,mode==='skip'?{type:'choose',skip:true}:{type:'choose',optionId:'roll'},pool,()=>mode==='even'?0.2:0);
 if(mode==='odd'){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}
 assert.equal(s.players[0].hand.length,mode==='even'?1:0);assert.equal(s.players[0].zones.center.cheer.length,mode==='odd'?3:2);
});
