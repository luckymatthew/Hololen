import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,fund,attack} from './fixtures/simulator-audit.mjs';
const oshi=cards.find(c=>c.group==='oshi'&&c.jpName==='アキ・ローゼンタール').number;
const tool=cards.find(c=>c.typeCode==='supportTool').number;
test('Aki own Collab recovery draws for the attached Axe',()=>{
 const s=state('hBP01-036');s.phase='main';s.players[0].zones.back1=unit('hBP01-036',{damage:20,attachments:[inst('hBP01-114','collab-axe')]});
 let e=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 assert.equal(e.pendingChoice?.effect,'heal');
 e=applyAction(e,0,{type:'choose',zone:'collab'},pool,()=>0);
 assert.equal(e.players[0].zones.collab.damage,0);assert.equal(e.players[0].hand.length,1);
});
for(const eligible of [false,true])test('Aki heals all own tool holders oshi '+eligible,()=>{
 const s=state('hBP03-022');s.players[0].oshi=inst(eligible?oshi:'AUDIT-OSHI');
 fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP03-022').arts[0].cost);
 s.players[0].zones.center.damage=20;
 s.players[0].zones.center.attachments=[inst('hBP01-114','center-axe')];
 s.players[0].zones.back1=unit('hBP01-037',{damage:20,attachments:[inst('hBP01-114','other-axe')]});
 s.players[0].zones.back2=unit('AUDIT-DUMMY',{damage:5,attachments:[inst(tool,'back2')]});
 s.players[0].zones.back3=unit('AUDIT-DUMMY',{damage:20,attachments:[inst('hBP01-119','mascot')]});
 s.players[1].zones.back1=unit('AUDIT-DUMMY',{damage:20,attachments:[inst(tool,'opponent')]});
 const e=applyAction(s,0,attack,pool,()=>0);
 assert.equal(e.players[0].zones.center.damage,eligible?20:30);assert.equal(e.players[0].zones.back1.damage,eligible?10:20);assert.equal(e.players[0].zones.back2.damage,eligible?0:5);
 assert.equal(e.players[0].zones.back3.damage,20);assert.equal(e.players[1].zones.back1.damage,20);assert.equal(e.pendingChoice,null);
 assert.equal(e.players[0].hand.length,eligible?1:0,'Axe draws only when its equipped Aki is healed by that same Holomen ability');
});
