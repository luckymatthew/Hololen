import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
test('096 two mandatory cheer attachments',()=>{
 const watame=cards.find(c=>c.group==='holomem'&&c.jpName==='角巻わため'),subaru=cards.find(c=>c.group==='holomem'&&c.jpName==='大空スバル');
 let s=state(watame.number);s.phase='main';s.players[0].zones.back1=unit(subaru.number);s.players[0].hand=[inst('hBP06-096','event')];s.players[0].archive=[inst('hY01-001','a'),inst('hY01-001','b')];
 s=applyAction(s,0,{type:'play',cardId:'event'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);
 assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['a']},pool,()=>0);
 assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['b']},pool,()=>0);
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer[0].id,'a');assert.equal(s.players[0].zones.back1.cheer[0].id,'b');assert.equal(s.pendingChoice,null);
});


