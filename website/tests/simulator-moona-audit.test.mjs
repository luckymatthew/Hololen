import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,attack,fund} from './fixtures/simulator-audit.mjs';
const act=(s,a,die=2)=>applyAction(structuredClone(s),0,a,pool,()=>(die-.5)/6);
function setup(back=true,lethal=false){
 const s=state('hBP01-088');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP01-088').arts[0].cost);
 if(back)s.players[1].zones.back1=unit('AUDIT-DUMMY',{stack:[inst('AUDIT-DUMMY','back')],damage:lethal?9990:0});
 return act(s,attack);
}
for(const die of [1,2,3,4,5,6,null])test('Moona optional die '+die,()=>{
 let s=setup();assert.equal(s.pendingChoice?.effect,'moonaArtRoll');
 let calls=0;
 s=applyAction(s,0,die===null?{type:'choose',skip:true}:{type:'choose',optionId:'roll'},pool,()=>{calls++;return (die-.5)/6;});
 if(die===null)assert.equal(calls,0);
 if(die!==null&&die%2===0){
  assert.equal(s.pendingChoice?.effect,'specialDamage');
  assert.throws(()=>act(s,{type:'choose',skip:true}));
  assert.throws(()=>act(s,{type:'choose',zone:'center'}));
  s=act(JSON.parse(JSON.stringify(s)),{type:'choose',zone:'back1'});
  assert.equal(s.players[1].zones.back1.damage,20);
 }else assert.equal(s.players[1].zones.back1.damage,0);
 assert.equal(s.players[1].zones.center.damage,10);assert.equal(s.pendingChoice,null);
});
test('Moona even die with no back target finishes normally',()=>{
 const s=act(setup(false),{type:'choose',optionId:'roll'});assert.equal(s.pendingChoice,null);assert.equal(s.players[1].zones.center.damage,10);
});
test('Moona special knockout archives victim without losing life',()=>{
 let s=act(setup(true,true),{type:'choose',optionId:'roll'});const lives=s.players[1].life.map(c=>c.id);
 s=act(s,{type:'choose',zone:'back1'});assert.equal(s.players[1].zones.back1,null);assert.deepEqual(s.players[1].life.map(c=>c.id),lives);assert.ok(s.players[1].archive.some(c=>c.id==='back'));
});
