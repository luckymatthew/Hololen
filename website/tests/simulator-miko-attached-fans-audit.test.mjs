import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const count of [0,1,3])test('Miko counts only own attached 35P '+count,()=>{
 const s=state('hBP03-030');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP03-030').arts[0].cost);
 s.players[0].zones.center.attachments=Array.from({length:count},(_,i)=>inst('hBP03-107','fan'+i));
 s.players[0].zones.center.attachments.push(inst('hBP01-122','otherFan'));
 s.players[0].zones.back1=unit('AUDIT-DUMMY',{attachments:[inst('hBP03-107','otherHolder')]});
 const e=applyAction(s,0,attack,pool,()=>0);assert.equal(e.players[1].zones.center.damage,120+count*20);
});
