import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
test('0767 required AZKi top-four selection',()=>{
 let s=state('hBP07-063');s.phase='main';s.players[0].hand=[inst('hBP07-067','bloom')];
 s.players[0].mainDeck=[inst('hBP07-063','pick'),...['a','b','c','tail'].map(id=>inst('AUDIT-DUMMY',id))];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.selectableIds,['pick']);
 s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);s=applyAction(s,0,{type:'choose',cardIds:['c','b','a']},pool,()=>0);
 assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),['tail','c','b','a']);assert.equal(s.players[0].hand.at(-1).id,'pick');
});
for(const pay of [true,false])test('0767 optional cost then required damage '+pay,()=>{
 let s=state('hBP07-067');fund(s.players[0].zones.center,['紫','無色']);s.players[0].hand=[inst('AUDIT-DUMMY','cost')];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.optional,true);
 s=applyAction(s,0,pay?{type:'choose',cardIds:['cost']}:{type:'choose',skip:true},pool,()=>0);
 if(pay){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}
 assert.equal(s.players[1].zones.center.damage,pay?60:40);assert.equal(s.players[0].archive.some(c=>c.id==='cost'),pay);
});
