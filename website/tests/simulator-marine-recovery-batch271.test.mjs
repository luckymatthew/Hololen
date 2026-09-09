import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
for(const available of [true,false])test('Marine SP mandatory red recovery '+available,()=>{const red=cards.find(c=>c.group==='holomem'&&c.colors?.includes('紅'));let s=state();s.phase='main';s.players[0].oshi=inst('hSD09-001');s.players[0].holoPower=[inst('AUDIT-DUMMY','hp')];s.players[0].archive=available?[inst(red.number,'red'),inst('hY03-001','cheer')]:[];s=applyAction(s,0,{type:'spOshiSkill'},pool,()=>0);if(available){assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,1);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['red']);s=applyAction(s,0,{type:'choose',cardIds:['red']},pool,()=>0);assert.ok(s.players[0].hand.some(c=>c.id==='red'));}else assert.equal(s.pendingChoice,null);});
