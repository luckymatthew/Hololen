import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const skip of [true,false])test('Staff First archives two then optional recovery '+skip,()=>{
 const staff=cards.find(c=>c.jpName==='ライブスタッフ');let s=state('hBP07-044');fund(s.players[0].zones.center,['紅','紅']);s.players[0].mainDeck=[inst('AUDIT-DUMMY','top'),inst(staff.number,'staff'),inst('AUDIT-DUMMY','third')];
 s=applyAction(s,0,attack,pool,()=>0);assert.deepEqual(s.players[0].archive.map(c=>c.id),['top','staff']);assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),['third']);assert.equal(s.pendingChoice.optional,true);
 s=applyAction(s,0,skip?{type:'choose',skip:true}:{type:'choose',cardIds:['staff']},pool,()=>0);assert.equal(s.players[0].hand.length,skip?0:1);assert.equal(s.players[1].zones.center.damage,120);
});

