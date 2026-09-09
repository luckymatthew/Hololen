import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack,fund} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
function start(n,bird=true){
 const s=state(n==='hBP01-059'?n:bird?'hBP01-015':'AUDIT-DUMMY');
 s.players[0].hand=[inst('AUDIT-DUMMY','cost')];
 s.players[0].mainDeck=[inst(n==='hBP01-059'?'hBP01-017':'hBP01-116','good'),inst('hBP01-027','buzz'),inst('hBP01-015','debut'),inst('AUDIT-DUMMY','tail')];
 if(n==='hBP01-059'){fund(s.players[0].zones.center,cards.find(c=>c.number===n).arts[1].cost);return act(s,{...attack,artIndex:1});}
 s.phase='main';s.players[0].zones.back1=unit(n);s.players[0].mainDeck.unshift(inst('AUDIT-DUMMY','power'));return act(s,{type:'collab',zone:'back1'});
}
for(const n of ['hBP01-059','hBP01-063']){
 test(n+' paid exact search',()=>{
  let s=start(n);assert.equal(s.pendingChoice?.effect,'genericKeywordHandArchiveCost');
  s=act(s,{type:'choose',cardIds:['cost']});assert.equal(s.pendingChoice?.effect,'deckToHandShuffle');
  assert.deepEqual(s.pendingChoice.selectableIds,['good']);
  s=act(s,{type:'choose',cardIds:['good']});assert.equal(s.players[0].hand[0].id,'good');assert.ok(s.players[0].archive.some(c=>c.id==='cost'));
 });
 test(n+' cost decline retains hand',()=>{
  const s=act(start(n),{type:'choose',skip:true});assert.equal(s.players[0].hand[0].id,'cost');assert.equal(s.pendingChoice,null);
 });
 test(n+' paid hidden search decline keeps payment',()=>{
  let s=act(start(n),{type:'choose',cardIds:['cost']});s=act(s,{type:'choose',skip:true});
  assert.equal(s.players[0].hand.length,0);assert.ok(s.players[0].archive.some(c=>c.id==='cost'));assert.equal(s.pendingChoice,null);
 });
}
test('Kiara requires Bird center',()=>assert.equal(start('hBP01-063',false).pendingChoice,null));
