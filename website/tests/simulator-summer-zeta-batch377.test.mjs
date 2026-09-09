import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const buzz of [true,false])test('Summer Zeta draw needs ID3 Buzz '+buzz,()=>{
 let s=state('hBP05-018');fund(s.players[0].zones.center,['白']);s.players[0].zones.back1=unit(buzz?'hBP07-019':cards.find(c=>c.tags?.includes('#ID3期生')&&c.stage==='Debut').number);s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[0].hand.length,buzz?1:0);
});


test('Summer Zeta KO requires ID3 first search',()=>{
 let s=state('hBP05-018');fund(s.players[0].zones.center,['白','無色','無色']);s.players[1].zones.center.damage=9990;s.players[1].zones.back1=unit('AUDIT-DUMMY');s.players[0].mainDeck=[inst('hBP07-019','find'),inst('AUDIT-DUMMY','other')];s=applyAction(s,0,{...attack,artIndex:1},pool,()=>0);
 while(s.pendingChoice?.type==='lifeCheerTarget')s=applyAction(s,1,{type:'choose',zone:'back1'},pool,()=>0);
 assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.selectableIds,['find']);assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));s=applyAction(s,0,{type:'choose',cardIds:['find']},pool,()=>0);assert.ok(s.players[0].hand.some(c=>c.id==='find'));
});
