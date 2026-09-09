import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
for(const debut of [true,false])test('Lui Oshi hits both eligible front positions '+debut,()=>{
 const dummy=pool.find(c=>c.number==='AUDIT-DUMMY');const p=[...pool,{...dummy,number:'SECOND',stage:'2nd'}];let s=state('AUDIT-DUMMY','SECOND');s.phase='main';s.players[1].zones.collab=unit(debut?'AUDIT-DUMMY':'SECOND');s.players[0].oshi=inst('hBP08-005');s.players[0].holoPower=[inst('AUDIT-DUMMY','p1'),inst('AUDIT-DUMMY','p2')];s.players[0].hand=[inst('AUDIT-DUMMY','a'),inst('AUDIT-DUMMY','b')];
 s=applyAction(s,0,{type:'oshiSkill'},p,()=>0);s=applyAction(s,0,{type:'choose',cardIds:['a','b']},p,()=>0);assert.equal(s.players[1].zones.center.damage,50);assert.equal(s.players[1].zones.collab.damage,debut?0:50);assert.equal(s.players[0].hand.length,0);assert.equal(s.pendingChoice,null);
});
