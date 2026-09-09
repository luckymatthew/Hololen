import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const valid of [true,false])test('0761 Shiori oshi top look '+valid,()=>{
 let s=state('hBP07-059');s.phase='main';s.players[0].hand=[inst('hBP07-061','bloom')];
 if(valid)s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='シオリ・ノヴェラ').number);
 s.players[0].mainDeck=[inst(cards.find(c=>c.group==='support').number,'pick'),...['a','b','c','tail'].map(id=>inst('AUDIT-DUMMY',id))];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 if(valid){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.selectableIds,['pick']);
 s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);s=applyAction(s,0,{type:'choose',cardIds:['c','b','a']},pool,()=>0);
 assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),['tail','c','b','a']);assert.equal(s.players[0].hand.at(-1).id,'pick');}
 else {assert.equal(s.pendingChoice,null);assert.equal(s.players[0].mainDeck.length,5);}
});
for(const target of [true,false])test('0761 required back damage '+target,()=>{
 let s=state('hBP07-061');fund(s.players[0].zones.center,['藍']);if(target)s.players[1].zones.back1=unit('AUDIT-DUMMY');
 s=applyAction(s,0,attack,pool,()=>0);
 if(target){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['back1']);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[1].zones.back1.damage,20);}
 else assert.equal(s.pendingChoice,null);
});
