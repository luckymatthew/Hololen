import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const mode of ['valid','wrong','back','none'])test('005-012 third-generation collab '+mode,()=>{
 const s=state('hBP05-012');fund(s.players[0].zones.center,['白','無色','無色']);if(mode==='valid')s.players[0].zones.collab=unit('hBP05-012');if(mode==='wrong')s.players[0].zones.collab=unit('AUDIT-DUMMY');if(mode==='back')s.players[0].zones.back1=unit('hBP05-012');assert.equal(applyAction(s,0,{...attack,artIndex:1},pool,()=>0).players[1].zones.center.damage,mode==='valid'?160:130);
});
