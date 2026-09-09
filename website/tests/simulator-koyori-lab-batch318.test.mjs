import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
for(const lab of [true,false])test('Koyori holoX buff with lab '+lab,()=>{
 let s=state('hBP06-021');s.phase='main';s.players[0].zones.back1=unit('hBP06-021');
 if(lab){const support=cards.find(c=>c.group==='support'&&c.tags?.includes('#こよラボ'));assert.ok(support);s.players[0].zones.center.attachments=[inst(support.number)];}
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.ok(s.players[0].zones.center.modifiers.some(m=>m.kind==='arts'&&m.amount===(lab?50:30)));
});
