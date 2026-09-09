import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,fund} from './fixtures/simulator-audit.mjs';
for(const available of [true,false])test('Paid non-Buzz search required '+available,()=>{
 const target=cards.find(c=>c.group==='holomem'&&c.stage==='1st'&&!/Buzz/i.test(c.type));let s=state();s.phase='main';fund(s.players[0].zones.center,['白']);s.players[0].hand=[inst('hSD01-019','play')];s.players[0].mainDeck=[inst(available?target.number:'AUDIT-DUMMY','pick')];s=applyAction(s,0,{type:'play',cardId:'play'},pool,()=>0);s=applyAction(s,0,{type:'choose',cheerId:'cheer0'},pool,()=>0);
 if(available){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'pick');}else assert.equal(s.pendingChoice,null);assert.equal(s.players[0].zones.center.cheer.length,0);
});
