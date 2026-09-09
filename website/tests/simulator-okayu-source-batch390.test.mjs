import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
for (const target of ['center','back1']) test('Okayu Oshi Gift bonus targeting '+target,()=>{
 let s=state('hBP05-045','AUDIT-DUMMY');s.phase='main';s.players[1].zones.back1=unit('AUDIT-DUMMY');s.players[0].oshi=inst('hBP05-004');s.players[0].holoPower=Array.from({length:10},(_,i)=>inst('AUDIT-DUMMY','p'+i));s=applyAction(s,0,{type:'oshiSkill'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:target},pool,()=>0);assert.equal(s.players[1].zones[target].damage,target==='center'?30:10);
});
