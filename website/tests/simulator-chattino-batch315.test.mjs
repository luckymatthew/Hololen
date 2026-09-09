import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,attack} from './fixtures/simulator-audit.mjs';
for(const valid of [true,false])test('Chattino extra HP requires Raora Oshi '+valid,()=>{
 const raora=cards.find(c=>c.group==='holomem'&&c.jpName==='ラオーラ・パンテーラ'&&c.stage==='1st');
 let s=state('AUDIT-DUMMY',raora.number);
 s.players[1].oshi=inst(valid?'hBP06-001':'AUDIT-OSHI');
 s.players[1].zones.center.attachments=[inst('hBP06-100','mascot')];
 s.players[1].zones.center.damage=Number(raora.hp)-85;
 s.players[1].zones.back1=unit('AUDIT-DUMMY');
 s=applyAction(s,0,attack,pool,()=>0);
 assert.equal(Boolean(s.players[1].zones.center),valid);
});
