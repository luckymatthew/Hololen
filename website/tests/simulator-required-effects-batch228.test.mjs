import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const available of [true,false])test('0809 required power support '+available,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP08-009');const support=cards.find(c=>c.group==='support');s.players[0].holoPower=[inst(available?support.number:'AUDIT-DUMMY','pick')];s.players[0].mainDeck=[inst('AUDIT-DUMMY','collab'),inst('AUDIT-DUMMY','refill')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(available){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'pick');assert.ok(s.players[0].holoPower.some(c=>c.id==='refill'));}else {assert.equal(s.pendingChoice,null);assert.equal(s.players[0].mainDeck[0].id,'refill');}
});
for(const valid of [true,false])test('0881 center Kanade recipient '+valid,()=>{
 let s=state(valid?'hBP08-077':'AUDIT-DUMMY');s.phase='main';if(!valid)s.players[0].zones.back1=unit('hBP08-077');s.players[0].hand=[inst('hBP08-081','bloom')];s.players[0].archive=[inst('hY01-001','cheer')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:valid?'center':'back1'},pool,()=>0);
 if(valid){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['cheer']},pool,()=>0);assert.deepEqual(s.pendingChoice.options,['center']);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer.length,1);}else assert.equal(s.pendingChoice,null);
});
for(const valid of [true,false])for(const zone of ['center','collab'])test('0888 gated bonus '+valid+zone,()=>{
 const third=cards.find(c=>c.group==='holomem'&&c.tags.includes('#3期生'));
 let s=state(zone==='center'?'hBP08-088':valid?third.number:'AUDIT-DUMMY');if(zone==='collab')s.players[0].zones.collab=unit('hBP08-088');fund(s.players[0].zones[zone],['黃','黃','白']);
 s=applyAction(s,0,{...attack,sourceZone:zone},pool,()=>0);assert.equal(s.players[1].zones.center.damage,zone==='collab'&&valid?170:140);
});
