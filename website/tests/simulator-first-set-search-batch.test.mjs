import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
const specs=[
 ['hBP01-019','hBP01-015',['hBP01-015','hBP01-017'],['hBP01-020','hBP04-015','hBP01-024']],
 ['hBP01-026','hBP01-024',['hBP01-024','hBP01-025'],['hBP01-027','hBP01-017','hBP01-020']],
 ['hBP01-020',null,['hBP01-015','hBP01-017','hBP01-020','hBP04-015'],['hBP01-024']]
];
function start(spec,empty=false,fromFirst=false){
 const [n,lower,good,bad]=spec,s=state(lower||'AUDIT-DUMMY');s.phase='main';
 s.players[0].mainDeck=[...(empty?[]:good.map((n,i)=>inst(n,'good'+i))),...bad.map((n,i)=>inst(n,'bad'+i)),inst('AUDIT-DUMMY','tail')];
 if(!lower){s.players[0].zones.back1=unit(n);s.players[0].mainDeck.unshift(inst('AUDIT-DUMMY','power'));return act(s,{type:'collab',zone:'back1'});}
 if(fromFirst)s.players[0].zones.center=unit(n==='hBP01-019'?'hBP01-017':'hBP01-025');
 s.players[0].hand=[inst(n,'bloom')];return act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
}
for(const spec of specs){
 const [n,,good]=spec;
 test(n+' exact eligible search and one public hand card',()=>{
  let s=start(spec);assert.equal(s.pendingChoice?.effect,'deckToHandShuffle');
  assert.deepEqual(s.pendingChoice.selectableIds,good.map((_,i)=>'good'+i));
  assert.throws(()=>act(s,{type:'choose',cardIds:['bad0']}));
  const before=s.players[0].mainDeck.filter(c=>c.id!=='good0').map(c=>c.id);
  s=act(s,{type:'choose',cardIds:['good0']});
  assert.deepEqual(s.players[0].hand.map(c=>c.id),['good0']);
  assert.notDeepEqual(s.players[0].mainDeck.map(c=>c.id),before);
  assert.ok(s.log.some(e=>e.revealRefs?.some(c=>c.id==='good0')));
 });
 test(n+' hidden search decline still shuffles',()=>{
  const s=start(spec),before=s.players[0].mainDeck.map(c=>c.id);
  const e=act(s,{type:'choose',skip:true});assert.equal(e.pendingChoice,null);
  assert.equal(e.players[0].hand.length,0);assert.notDeepEqual(e.players[0].mainDeck.map(c=>c.id),before);
 });
 test(n+' absent eligible cards finishes',()=>assert.equal(start(spec,true).pendingChoice,null));
 if(spec[1])test(n+' only Debut Bloom activates',()=>assert.equal(start(spec,false,true).pendingChoice,null));
}
