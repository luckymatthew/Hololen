import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
for(const pay of [true,false])test('Choco paid food event search '+pay,()=>{
 const food=cards.find(c=>c.group==='support'&&c.typeCode.includes('Event')&&c.tags.includes('#食物'));assert.ok(food);let s=state();s.phase='main';s.players[0].zones.back1=unit('hSD04-004');s.players[0].hand=[inst('AUDIT-DUMMY','pay')];s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(food.number,'pick')];s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);s=applyAction(s,0,pay?{type:'choose',cardIds:['pay']}:{type:'choose',skip:true},pool,()=>0);if(pay){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'pick');}else assert.equal(s.pendingChoice,null);
});
