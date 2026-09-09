import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,attack,fund} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
for(const count of [0,1,5,6,7,10])test('Kiara counts before returning '+count,()=>{
 const s=state('hBP01-067');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP01-067').arts[1].cost);
 s.players[0].archive=Array.from({length:count},(_,i)=>inst('AUDIT-DUMMY','h'+i)).concat(inst('hY03-001','cheer'));
 const deck=s.players[0].mainDeck.map(c=>c.id);
 let e=act(s,{...attack,artIndex:1});
 if(count){
  assert.equal(e.pendingChoice?.effect,'kiaraArchiveReturnSix');assert.equal(e.pendingChoice.min,Math.min(6,count));
  assert.equal(e.players[1].zones.center.damage,0);
  assert.throws(()=>act(e,{type:'choose',skip:true}));
  assert.throws(()=>act(e,{type:'choose',cardIds:['cheer']}));
  const ids=Array.from({length:Math.min(6,count)},(_,i)=>'h'+(count-1-i));
  e=act(e,{type:'choose',cardIds:ids});
  assert.ok(ids.every(id=>e.players[0].mainDeck.some(c=>c.id===id)));
 }
 assert.equal(e.players[1].zones.center.damage,80+count*10);
 assert.equal(e.players[0].archive.length,1+Math.max(0,count-6));
 assert.ok(e.players[0].archive.some(c=>c.id==='cheer'));
 assert.equal(e.players[0].mainDeck.length,deck.length+Math.min(6,count));
 assert.notDeepEqual(e.players[0].mainDeck.slice(0,deck.length).map(c=>c.id),deck);
});
