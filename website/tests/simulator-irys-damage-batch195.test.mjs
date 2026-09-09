import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const purple of [true,false])for(const collab of [true,false])test('0814 fixed damage '+purple+collab,()=>{
 let s=state('hBP08-010');s.phase='main';s.players[0].hand=[inst('hBP08-014','bloom')];s.players[0].zones.center.cheer=[inst(purple?'hY05-001':'hY01-001')];
 if(collab)s.players[1].zones.collab=unit('AUDIT-DUMMY');
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.players[1].zones.center.damage,30);
 if(collab)assert.equal(s.players[1].zones.collab.damage,purple?30:0);
 assert.equal(s.pendingChoice,null);
});
