import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
for(const purple of [true,false])test('Purple Oshi draw gate '+purple,()=>{
 const oshi=cards.find(c=>c.group==='oshi'&&c.colors.includes(purple?'紫':'紅'));let s=state();s.phase='main';s.players[0].oshi=inst(oshi.number);s.players[0].zones.back1=unit('hSD04-003');s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.players[0].hand.length,purple?1:0);
});
