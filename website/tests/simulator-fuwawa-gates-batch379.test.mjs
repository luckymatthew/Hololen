import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const [arts,skill] of [[false,false],[true,false],[false,true],[true,true]])test('Fuwawa turn gates '+arts+' '+skill,()=>{
 let s=state('hBP05-050');fund(s.players[0].zones.center,['藍','無色','無色']);const moco=cards.find(c=>c.jpName==='モココ・アビスガード');s.players[0].turnEvents={turn:3,arts:arts?[moco.number]:[],supports:[]};const oshi=cards.find(c=>c.oshiSkill?.name==='モコちゃん！');s.players[0].oshi=inst(oshi.number);s.players[0].oshiSkillTurn=skill?3:2;s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,100+(arts?40:0)+(skill?30:0));
});


test('Fuwawa Buzz DOWN loses two life',()=>{let s=state('AUDIT-DUMMY','hBP05-050');s.players[1].zones.center.damage=cards.find(c=>c.number==='hBP05-050').hp-10;s.players[1].zones.back1=unit('AUDIT-DUMMY');s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].life.length,3);assert.ok(s.players[1].archive.some(c=>c.number==='hBP05-050'));});
