import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const mode of ['valid','noTarget','emptyDeck'])test('070 required top Cheer '+mode,()=>{
 let s=state('hBP03-070');fund(s.players[0].zones.center,['無色','無色']);s.players[0].zones.collab=unit('hBP03-070');s.players[0].zones.back2=unit('AUDIT-DUMMY');
 if(mode!=='noTarget')s.players[0].zones.back1=unit('hBP03-070');if(mode!=='emptyDeck')s.players[0].cheerDeck=[inst('hY01-001','top'),inst('hY02-001','next')];
 s=applyAction(s,0,attack,pool,()=>0);
 if(mode==='valid'){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['back1']);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[0].zones.back1.cheer[0].id,'top');assert.equal(s.players[0].cheerDeck[0].id,'next');}
 assert.equal(s.pendingChoice,null);assert.equal(s.players[1].zones.center.damage,30);
});
