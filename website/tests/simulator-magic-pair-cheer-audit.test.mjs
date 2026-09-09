import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const pairs={'hBP02-069':['hY03-001','hY04-001'],'hBP02-070':['hY01-001','hY02-001'],'hBP02-071':['hY05-001','hY06-001']};
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
function setup(number){const s=state();s.phase='main';s.players[0].zones.back1=unit(number);s.players[0].zones.back2=unit('AUDIT-DUMMY');s.players[0].cheerDeck=Array.from({length:6},(_,i)=>inst('hY0'+(i+1)+'-001','cheer'+i));return act(s,{type:'collab',zone:'back1'});}
for(const number of Object.keys(pairs))for(const die of [1,2,3,4,5,6,null])test(number+' die '+die,()=>{
 let s=setup(number);assert.equal(s.pendingChoice?.effect,'magicPairCheerRoll');let calls=0;
 s=applyAction(s,0,die===null?{type:'choose',skip:true}:{type:'choose',optionId:'roll'},pool,()=>{calls++;return(die-.5)/6;});
 if(die===null)assert.equal(calls,0);
 if(die!==null&&die%2===1){
  assert.equal(s.pendingChoice?.effect,'genericCheerDeckPick');
  assert.deepEqual(s.pendingChoice.cards.filter(c=>s.pendingChoice.selectableIds.includes(c.id)).map(c=>c.number),pairs[number]);
  const id=s.pendingChoice.selectableIds[0],before=s.players[0].cheerDeck.filter(c=>c.id!==id).map(c=>c.id);
  s=act(s,{type:'choose',cardIds:[id]});assert.deepEqual(s.players[0].cheerDeck.map(c=>c.id),before);
  assert.equal(s.pendingChoice.type,'eventCheerTarget');assert.throws(()=>act(s,{type:'choose',zone:'center'}));assert.throws(()=>act(s,{type:'choose',zone:'collab'}));assert.throws(()=>act(s,{type:'choose',skip:true}));
  s=act(JSON.parse(JSON.stringify(s)),{type:'choose',zone:'back2'});assert.equal(s.players[0].zones.back2.cheer[0].id,id);assert.notDeepEqual(s.players[0].cheerDeck.map(c=>c.id),before);
 }else assert.equal(s.players[0].zones.back2.cheer.length,0);
 assert.equal(s.pendingChoice,null);
});
for(const number of Object.keys(pairs))test(number+' conditional search can decline and shuffles',()=>{
 let s=applyAction(setup(number),0,{type:'choose',optionId:'roll'},pool,()=>0);const before=s.players[0].cheerDeck.map(c=>c.id);
 s=act(s,{type:'choose',skip:true});assert.equal(s.pendingChoice,null);assert.notDeepEqual(s.players[0].cheerDeck.map(c=>c.id),before);
});

for(const number of Object.keys(pairs))test(number+' no recipient preserves all Cheer',()=>{
 let s=setup(number);s.players[0].zones.back2=null;const ids=s.players[0].cheerDeck.map(c=>c.id).sort();
 s=applyAction(s,0,{type:'choose',optionId:'roll'},pool,()=>0);assert.equal(s.pendingChoice,null);assert.deepEqual(s.players[0].cheerDeck.map(c=>c.id).sort(),ids);
});
