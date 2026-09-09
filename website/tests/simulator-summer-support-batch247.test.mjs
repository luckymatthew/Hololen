import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,attack} from './fixtures/simulator-audit.mjs';
test('Summer concert requires archive Cheer',()=>{
 let s=state();s.phase='main';s.players[0].hand=[inst('hEB01-027','play')];s.players[0].archive=[inst('hY01-001','cheer')];s=applyAction(s,0,{type:'play',cardId:'play'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['cheer']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer[0].id,'cheer');
});
for(const summer of [true,false])test('Beach ball summer-only bonus '+summer,()=>{
 const p=pool.map(c=>c.number==='AUDIT-DUMMY'?{...c,tags:summer?['#サマー']:[]}:c);let s=state();s.players[0].zones.center.attachments=[inst('hEB01-033')];s=applyAction(s,0,attack,p,()=>0);assert.equal(s.players[1].zones.center.damage,summer?110:100);
});
