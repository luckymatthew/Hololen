import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state} from './fixtures/simulator-audit.mjs';
test('0791 required recovery after paid fan attachment',()=>{
 let s=state('hBP07-064');s.phase='main';s.players[0].hand=[inst('hBP07-091','event')];s.players[0].zones.center.cheer=[inst('hY01-001','cost')];
 const fan=cards.find(c=>c.jpName==='開拓者');
 s.players[0].archive=[inst(fan.number,'fan'),inst('hBP07-064','recover')];
 s=applyAction(s,0,{type:'play',cardId:'event'},pool,()=>0);
 s=applyAction(s,0,{type:'choose',zone:'center',cheerId:'cost'},pool,()=>0);
 s=applyAction(s,0,{type:'choose',cardIds:['fan']},pool,()=>0);
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.pendingChoice.optional,false);
 s=applyAction(s,0,{type:'choose',cardIds:['recover']},pool,()=>0);
 assert.equal(s.players[0].hand.at(-1).id,'recover');assert.equal(s.players[0].zones.center.attachments.at(-1).id,'fan');
});
