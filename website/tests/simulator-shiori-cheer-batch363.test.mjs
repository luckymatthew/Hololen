import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const count of [2,3])test('Shiori recipient cheer threshold '+count,()=>{
 let s=state('hBP07-062');fund(s.players[0].zones.center,['藍']);s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='シオリ・ノヴェラ').number);s.players[0].zones.back1=unit('hBP07-062');fund(s.players[0].zones.back1,Array(count).fill('藍'));s.players[0].archive=[inst('hY04-001','archive')];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));s=applyAction(s,0,{type:'choose',cardIds:['archive']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[0].zones.back1.cheer.length,count+1);assert.equal(s.players[1].zones.center.damage,count===3?160:60);
});
