import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
function start(deck){
 const lower=cards.find(c=>c.jpName==='小鳥遊キアラ'&&c.stage==='Debut');
 const s=state(lower.number);s.phase='main';s.players[0].hand=[inst('hBP01-065','bloom')];s.players[0].mainDeck=deck;
 return act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
}
test('Kiara top three filters Holomen and archives exactly the remainder',()=>{
 let s=start([inst('hBP01-065','a'),inst('hBP01-103','support'),inst('hBP01-065','b'),inst('hBP01-103','tail')]);
 assert.deepEqual(s.pendingChoice.selectableIds,['a','b']);
 assert.throws(()=>act(s,{type:'choose',cardIds:['support']}));
 s=act(s,{type:'choose',cardIds:['b']});
 assert.deepEqual(s.players[0].hand.map(c=>c.id),['b']);
 assert.deepEqual(s.players[0].archive.map(c=>c.id),['a','support']);
 assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),['tail']);
});
test('Kiara hidden selection decline archives all looked-at cards',()=>{
 let s=start([inst('hBP01-065','a'),inst('hBP01-103','support'),inst('hBP01-065','b'),inst('hBP01-103','tail')]);
 s=act(s,{type:'choose',skip:true});assert.equal(s.players[0].hand.length,0);
 assert.deepEqual(s.players[0].archive.map(c=>c.id),['a','support','b']);
 assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),['tail']);
});
test('Kiara no Holomen archives the three cards immediately',()=>{
 const s=start(['a','b','c','tail'].map(id=>inst('hBP01-103',id)));
 assert.equal(s.pendingChoice,null);assert.deepEqual(s.players[0].archive.map(c=>c.id),['a','b','c']);
 assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),['tail']);
});
for(const count of [0,1,2])test(`Kiara handles deck size ${count}`,()=>{
 let s=start(Array.from({length:count},(_,i)=>inst('hBP01-065',String(i))));
 if(count)s=act(s,{type:'choose',cardIds:['0']});
 assert.equal(s.pendingChoice,null);assert.equal(s.players[0].mainDeck.length,0);
 assert.equal(s.players[0].hand.length,count?1:0);assert.equal(s.players[0].archive.length,Math.max(0,count-1));
});
