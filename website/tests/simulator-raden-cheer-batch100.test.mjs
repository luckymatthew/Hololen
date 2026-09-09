import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
test('004-002 mandatory archive Cheer to ReGLOSS',()=>{
 let s=state();s.phase='main';s.players[0].oshi=inst('hBP04-002');s.players[0].holoPower=[inst('AUDIT-DUMMY','p1'),inst('AUDIT-DUMMY','p2')];s.players[0].archive=[inst('hY01-001','cheer')];s.players[0].zones.back1=unit('hBP03-048');
 const act=a=>{s=applyAction(s,0,a,pool,()=>0)};
 act({type:'oshiSkill'});assert.equal(s.pendingChoice.optional,false);assert.equal(s.players[0].holoPower.length,0);act({type:'choose',cardIds:['cheer']});assert.deepEqual(s.pendingChoice.options,['back1']);act({type:'choose',zone:'back1'});assert.equal(s.players[0].zones.back1.cheer[0].id,'cheer');assert.equal(s.pendingChoice,null);
});
