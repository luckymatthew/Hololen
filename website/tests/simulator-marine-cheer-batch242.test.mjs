import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
test('Marine stacked Arts paid top Cheer required',()=>{
 let s=state('hEB01-015');s.players[0].zones.center.stack=[inst('hEB01-011','u1'),inst('hEB01-012','u2'),inst('hEB01-015','top')];fund(s.players[0].zones.center,['藍','白']);s.players[0].cheerDeck=[inst('hY01-001','new')];s=applyAction(s,0,attack,pool,()=>0);s=applyAction(s,0,{type:'choose',cheerId:'cheer0'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.ok(s.players[0].zones.center.cheer.some(c=>c.id==='new'));
});
test('Marine Bloom required source archive Cheer',()=>{
 let s=state('hEB01-013');s.phase='main';s.players[0].hand=[inst('hEB01-017','bloom')];s.players[0].archive=[inst('hY01-001','cheer')];s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['cheer']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer[0].id,'cheer');
});
