import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
for(const debutAvailable of [true,false])test('Koyori required grouped search '+debutAvailable,()=>{
 const support=cards.find(c=>c.group==='support'&&c.tags.includes('#こよラボ'));let s=state();s.phase='main';s.firstPlayer=1;s.players[0].turnsTaken=1;s.players[0].zones.back1=unit('hEB01-019');s.players[0].mainDeck=[inst(support.number,'power'),...(debutAvailable?[inst('hEB01-019','debut')]:[]),inst(support.number,'support')];s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 for(const id of [...(debutAvailable?['debut']:[]),'support']){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:[id]},pool,()=>0);}assert.equal(s.players[0].hand.length,debutAvailable?2:1);
});
