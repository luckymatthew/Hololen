import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const pay of [true,false])test('Ayame Arts paid required special damage '+pay,()=>{
 const card=cards.find(c=>c.number==='hSD02-008');let s=state(card.number);fund(s.players[0].zones.center,card.arts[1].cost);s.players[0].hand=[inst('AUDIT-DUMMY','pay')];s=applyAction(s,0,{...attack,artIndex:1},pool,()=>0);s=applyAction(s,0,pay?{type:'choose',cardIds:['pay']}:{type:'choose',skip:true},pool,()=>0);if(pay){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}assert.equal(s.players[1].zones.center.damage,pay?100:50);
});
