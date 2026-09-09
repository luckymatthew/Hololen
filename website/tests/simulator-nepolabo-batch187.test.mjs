import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const available of [true,false])test('0782 required gen-five 2nd '+available,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP07-082');
 const pick=cards.find(c=>c.group==='holomem'&&c.stage==='2nd'&&c.tags.includes('#5期生'));
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(available?pick.number:'AUDIT-DUMMY','pick'),inst('hBP07-077','debut')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(available){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);assert.equal(s.players[0].hand.at(-1).id,'pick');}
 else {assert.equal(s.pendingChoice,null);assert.equal(s.players[0].hand.length,0);}
});
