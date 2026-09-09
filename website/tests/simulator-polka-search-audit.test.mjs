import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
function start(){
 const lower=cards.find(c=>c.jpName==='尾丸ポルカ'&&c.stage==='Debut');
 const s=state(lower.number);s.phase='main';s.players[0].hand=[inst('hBP01-070','bloom')];
 s.players[0].mainDeck=[inst('hBP01-126','fan'),inst('hBP01-116','mascot'),inst('AUDIT-DUMMY','tail')];
 return act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
}
test('Polka searches only fans',()=>{
 let s=start();assert.deepEqual(s.pendingChoice.selectableIds,['fan']);
 assert.throws(()=>act(s,{type:'choose',cardIds:['mascot']}));
 s=act(s,{type:'choose',cardIds:['fan']});assert.equal(s.players[0].hand[0].id,'fan');
});
test('Polka hidden search decline shuffles',()=>{
 const s=start(),before=s.players[0].mainDeck.map(c=>c.id);
 const e=act(s,{type:'choose',skip:true});assert.equal(e.pendingChoice,null);assert.notDeepEqual(e.players[0].mainDeck.map(c=>c.id),before);
});
