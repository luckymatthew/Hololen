import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
test('Botan poi requires archived Cheer and back-row Botan recipient',()=>{
 const botan=cards.find(c=>c.jpName==='獅白ぼたん'&&c.stage==='Debut').number;
 const s=state(botan);s.phase='main';s.players[0].oshi=inst('hBP03-002');
 s.players[0].holoPower=[inst('AUDIT-DUMMY','p1'),inst('AUDIT-DUMMY','p2')];
 s.players[0].zones.back1=unit(botan);s.players[0].zones.back2=unit('AUDIT-DUMMY');
 s.players[0].archive=[inst('hY01-001','cheer'),inst('hBP01-119','support')];
 let e=act(s,{type:'oshiSkill'});assert.equal(e.pendingChoice.optional,false);assert.throws(()=>act(e,{type:'choose',skip:true}));
 assert.deepEqual(e.pendingChoice.selectableIds,['cheer']);e=act(e,{type:'choose',cardIds:['cheer']});
 assert.throws(()=>act(e,{type:'choose',skip:true}));assert.throws(()=>act(e,{type:'choose',zone:'center'}));assert.throws(()=>act(e,{type:'choose',zone:'back2'}));
 e=act(e,{type:'choose',zone:'back1'});assert.equal(e.players[0].zones.back1.cheer[0].id,'cheer');
 assert.equal(e.players[0].archive.some(c=>c.id==='cheer'),false);assert.equal(e.players[0].holoPower.length,0);
});
