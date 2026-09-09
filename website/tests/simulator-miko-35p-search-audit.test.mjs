import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
for(const skip of [false,true])test('Miko 35P search skip '+skip,()=>{
 const lower=cards.find(c=>c.jpName==='さくらみこ'&&c.stage==='Debut'),s=state(lower.number);s.phase='main';
 s.players[0].hand=[inst('hBP03-029','bloom')];s.players[0].mainDeck=[inst('hBP03-107','fan'),inst('hBP01-122','wrongFan'),inst('AUDIT-DUMMY','tail')];
 let e=act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
 assert.deepEqual(e.pendingChoice.selectableIds,['fan']);assert.throws(()=>act(e,{type:'choose',cardIds:['wrongFan']}));
 const before=e.players[0].mainDeck.map(c=>c.id);e=act(e,skip?{type:'choose',skip:true}:{type:'choose',cardIds:['fan']});
 assert.equal(e.players[0].hand.length,skip?0:1);assert.equal(e.players[0].mainDeck.length,skip?3:2);
 if(skip)assert.notDeepEqual(e.players[0].mainDeck.map(c=>c.id),before);else assert.equal(e.players[0].hand[0].id,'fan');
});
