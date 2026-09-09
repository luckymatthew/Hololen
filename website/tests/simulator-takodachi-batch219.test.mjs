import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const available of [true,false])test('0870 required Takodachi '+available,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP08-070');const c=cards.find(c=>c.jpName==='Takodachi'||c.name==='Takodachi');
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(available?c.number:'AUDIT-DUMMY','pick')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(available){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'pick');}
 else assert.equal(s.pendingChoice,null);
});
