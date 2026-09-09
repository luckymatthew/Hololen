import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack,fund} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
function start(){
 const s=state('hBP01-061');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP01-061').arts[0].cost);
 s.players[0].hand=Array.from({length:5},(_,i)=>inst('AUDIT-DUMMY','cost'+i));
 s.players[1].zones.collab=unit('AUDIT-DUMMY');return act(s,attack);
}
for(let count=1;count<=5;count++)for(const zone of ['center','collab'])test('paid '+count+' targets '+zone,()=>{
 let s=start();s=act(s,{type:'choose',cardIds:Array.from({length:count},(_,i)=>'cost'+i)});
 assert.equal(s.pendingChoice?.effect,'specialDamage');assert.equal(s.pendingChoice.optional,false);
 assert.throws(()=>act(s,{type:'choose',skip:true}));
 s=act(s,{type:'choose',zone});
 assert.equal(s.players[0].archive.length,count);assert.equal(s.players[0].hand.length,5-count);
 assert.equal(s.players[1].zones.center.damage,60+(zone==='center'?count*20:0));
 assert.equal(s.players[1].zones.collab.damage,zone==='collab'?count*20:0);
});
test('declining payment retains hand and printed Arts',()=>{
 const s=act(start(),{type:'choose',skip:true});
 assert.equal(s.players[0].hand.length,5);assert.equal(s.players[1].zones.center.damage,60);assert.equal(s.pendingChoice,null);
});
