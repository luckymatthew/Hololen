import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const pay of [true,false])test('037 paid special damage '+pay,()=>{
 let s=state('hBP06-037');fund(s.players[0].zones.center,['紅','紅']);s.players[0].cheerDeck=[inst('hY03-001','cost')];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.optional,true);
 s=applyAction(s,0,pay?{type:'choose',optionId:s.pendingChoice.modeOptions[0].id}:{type:'choose',skip:true},pool,()=>0);
 if(pay){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}
 assert.equal(s.players[1].zones.center.damage,pay?80:50);assert.equal(s.players[0].archive.some(c=>c.id==='cost'),pay);assert.equal(s.pendingChoice,null);
});
