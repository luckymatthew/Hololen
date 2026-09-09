import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst} from './fixtures/simulator-audit.mjs';
for(const fromDefeated of [true,false])test('Explicit DOWN recovery source '+fromDefeated,()=>{let s=state();const card=inst('AUDIT-DUMMY','under');s.players[0].zones.center.stack.unshift(card);s.players[0].zones.center.downPending=true;s.pendingChoice={type:'cardSelection',playerIndex:0,cards:[card],selectableIds:['under'],min:1,max:1,effect:'archiveToHand',source:'archive',meta:{fromDefeated}};const act=()=>applyAction(s,0,{type:'choose',cardIds:['under']},pool,()=>0);if(fromDefeated){s=act();assert.ok(s.players[0].hand.some(c=>c.id==='under'));assert.ok(!s.players[0].zones.center.stack.some(c=>c.id==='under'));assert.equal(s.players[0].archive.length,0);}else assert.throws(act);});
