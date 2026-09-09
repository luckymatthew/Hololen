import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,fund,attack} from './fixtures/simulator-audit.mjs';
const oshi=cards.find(c=>c.group==='oshi'&&c.jpName==='アキ・ローゼンタール').number;
const tool=cards.find(c=>c.typeCode==='supportTool').number;
for(const eligible of [false,true])test('Aki heals all own tool holders oshi '+eligible,()=>{
 const s=state('hBP03-022');s.players[0].oshi=inst(eligible?oshi:'AUDIT-OSHI');
 fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP03-022').arts[0].cost);
 s.players[0].zones.center.damage=20;
 for(const [z,d] of [['back1',20],['back2',5]])s.players[0].zones[z]=unit('AUDIT-DUMMY',{damage:d,attachments:[inst(tool,z)]});
 s.players[0].zones.back3=unit('AUDIT-DUMMY',{damage:20,attachments:[inst('hBP01-119','mascot')]});
 s.players[1].zones.back1=unit('AUDIT-DUMMY',{damage:20,attachments:[inst(tool,'opponent')]});
 const e=applyAction(s,0,attack,pool,()=>0);
 assert.equal(e.players[0].zones.center.damage,20);assert.equal(e.players[0].zones.back1.damage,eligible?10:20);assert.equal(e.players[0].zones.back2.damage,eligible?0:5);
 assert.equal(e.players[0].zones.back3.damage,20);assert.equal(e.players[1].zones.back1.damage,20);assert.equal(e.pendingChoice,null);
});
