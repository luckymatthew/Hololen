import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
for(const count of [1,2])test('Roboco can archive fans from hand then recover '+count,()=>{
 const fan=cards.find(c=>c.jpName==='ろぼさー');assert.ok(fan);
 let s=state('hBP06-064');s.phase='main';s.players[0].oshi=inst('hBP06-007');s.players[0].zones.back1=unit('hBP06-064');
 const ids=Array.from({length:count},(_,i)=>'fan'+i);s.players[0].hand=ids.map(id=>inst(fan.number,id));s.players[0].archive=[];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 assert.equal(s.pendingChoice.effect,'handArchiveThenNamedReturn');assert.equal(s.pendingChoice.max,count);
 s=applyAction(s,0,{type:'choose',cardIds:ids},pool,()=>0);
 s=applyAction(s,0,{type:'choose',cardIds:ids},pool,()=>0);
 assert.deepEqual(s.players[0].hand.map(c=>c.id),ids);
});
