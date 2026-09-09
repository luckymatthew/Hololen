import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state} from './fixtures/simulator-audit.mjs';
for(const available of [true,false])test('0891 required archive Debut '+available,()=>{
 const debut=cards.find(c=>c.group==='holomem'&&c.stage==='Debut'&&c.unlimited);
 assert.ok(debut);
 let s=state();s.phase='main';s.players[0].hand=[inst('hBP08-091','play')];s.players[0].mainDeck=[inst(debut.number,'deck')];s.players[0].archive=available?[inst('hBP08-077','archive')]:[];
 s=applyAction(s,0,{type:'play',cardId:'play'},pool,()=>0);s=applyAction(s,0,{type:'choose',cardIds:['deck']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);
 if(available){assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,1);s=applyAction(s,0,{type:'choose',cardIds:['archive']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'back2'},pool,()=>0);assert.equal(s.players[0].zones.back2.stack[0].id,'archive');}else assert.equal(s.pendingChoice,null);
 assert.equal(s.players[0].zones.back1.stack[0].id,'deck');
});
