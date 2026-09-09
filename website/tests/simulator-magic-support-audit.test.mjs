import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const allowed={'hBP02-072':['supportEvent','supportEventLimited'],'hBP02-073':['supportFan'],'hBP02-074':['supportTool']};
const types=['supportEvent','supportEventLimited','supportFan','supportTool','supportMascot'];
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
function setup(number){
 const s=state();s.phase='main';s.players[0].zones.back1=unit(number);
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),...types.map(type=>inst(cards.find(c=>c.typeCode===type).number,type)),inst('AUDIT-DUMMY','tail')];
 return act(s,{type:'collab',zone:'back1'});
}
for(const n of Object.keys(allowed))for(const die of [1,2,3,4,5,6,null])test(n+' die '+die,()=>{
 let s=setup(n);assert.equal(s.pendingChoice?.effect,'magicSupportRoll');let calls=0;
 s=applyAction(s,0,die===null?{type:'choose',skip:true}:{type:'choose',optionId:'roll'},pool,()=>{calls++;return(die-.5)/6;});
 if(die===null)assert.equal(calls,0);
 if(die!==null&&die%2===0){
  assert.equal(s.pendingChoice?.effect,'deckToHandShuffle');assert.deepEqual(s.pendingChoice.selectableIds,allowed[n]);assert.throws(()=>act(s,{type:'choose',cardIds:['supportMascot']}));
  const id=allowed[n].at(-1),before=s.players[0].mainDeck.filter(c=>c.id!==id).map(c=>c.id);
  s=act(JSON.parse(JSON.stringify(s)),{type:'choose',cardIds:[id]});assert.equal(s.players[0].hand[0].id,id);assert.notDeepEqual(s.players[0].mainDeck.map(c=>c.id),before);
 }else assert.equal(s.players[0].hand.length,0);
 assert.equal(s.pendingChoice,null);
});
for(const n of Object.keys(allowed))test(n+' may decline private search and shuffles',()=>{
 let s=applyAction(setup(n),0,{type:'choose',optionId:'roll'},pool,()=>.25);const before=s.players[0].mainDeck.map(c=>c.id);s=act(s,{type:'choose',skip:true});assert.equal(s.pendingChoice,null);assert.notDeepEqual(s.players[0].mainDeck.map(c=>c.id),before);assert.equal(s.players[0].hand.length,0);
});
