import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const count of [2,3,4])test('015 generation threshold '+count,()=>{
 let s=state('hBP05-015');fund(s.players[0].zones.center,['無色']);for(let i=1;i<count;i++)s.players[0].zones['back'+i]=unit('hBP05-012');s.players[0].cheerDeck=[inst('hY01-001','top')];s=applyAction(s,0,attack,pool,()=>0);
 if(count>=3){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['center']);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer[1].id,'top');}
 assert.equal(s.pendingChoice,null);assert.equal(s.players[0].zones.center.cheer.length,count>=3?2:1);assert.equal(s.players[1].zones.center.damage,30);
});
