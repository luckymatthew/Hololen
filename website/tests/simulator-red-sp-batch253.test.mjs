import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
for(const available of [true,false])test('Required red SP recovery '+available,()=>{
 const red=cards.find(c=>c.group==='holomem'&&c.colors.includes('紅'));let s=state();s.phase='main';s.players[0].oshi=inst('hSD02-001');s.players[0].holoPower=[inst('AUDIT-DUMMY','power')];s.players[0].archive=[inst(available?red.number:'AUDIT-DUMMY','pick')];s=applyAction(s,0,{type:'spOshiSkill'},pool,()=>0);if(available){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'pick');}else assert.equal(s.pendingChoice,null);
});
