import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
test('07105 required BAZO fan recovery',()=>{
 const z=cards.find(c=>c.group==='holomem'&&c.jpName==='ベスティア・ゼータ'&&c.arts.length);
 let s=state(z.number);fund(s.players[0].zones.center,z.arts[0].cost);s.players[0].zones.center.attachments=[inst('hBP07-105','mascot')];
 s.players[0].archive=[inst(cards.find(c=>c.typeCode==='supportFan').number,'fan')];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.optional,false);
 s=applyAction(s,0,{type:'choose',cardIds:['fan']},pool,()=>0);assert.equal(s.players[0].hand.at(-1).id,'fan');
});
for(const use of [true,false])test('07106 optional mascot return then required recovery '+use,()=>{
 let s=state();s.phase='main';const mio=cards.find(c=>c.group==='holomem'&&c.jpName==='大神ミオ'&&!c.keyword);
 s.players[0].zones.back1=unit(mio.number,{attachments:[inst('hBP07-106','mascot')]});s.players[0].archive=[inst('AUDIT-DUMMY','recover')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,true);
 s=applyAction(s,0,use?{type:'choose',optionId:'use'}:{type:'choose',skip:true},pool,()=>0);
 if(use){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['recover']},pool,()=>0);assert.equal(s.players[0].mainDeck[0].id,'mascot');}
 assert.equal(s.players[0].hand.length,use?1:0);
});
