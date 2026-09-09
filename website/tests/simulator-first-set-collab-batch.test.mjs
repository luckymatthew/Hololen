import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,inst,attack,fund,cards} from './fixtures/simulator-audit.mjs';
const act=(s,a,die=1)=>applyAction(structuredClone(s),0,a,pool,()=> (die-.5)/6);
function collab(n,oshi='hBP01-004'){
 const s=state();s.phase='main';s.players[0].oshi=inst(oshi);s.players[0].zones.back1=unit(n);s.players[0].zones.center=unit('hBP01-033',{damage:30});s.players[0].cheerDeck=[inst('hY02-001','cheer')];
 return act(s,{type:'collab',zone:'back1'});
}
for(const n of ['hBP01-033','hBP01-039']) {
 test(n+' decline does not roll',()=>{
  const s=collab(n);assert.equal(s.pendingChoice?.effect,'firstSetCollabRoll');
  const end=applyAction(s,0,{type:'choose',skip:true},pool,()=>{throw Error('unexpected roll');});
  assert.equal(end.pendingChoice,null);
 });
 for(let die=1;die<=6;die++) test(n+' result '+die,()=>{
  let s=act(collab(n),{type:'choose',optionId:'roll'},die);
  const success=n==='hBP01-033'?die%2===1:die%2===0;
  if(!success){assert.equal(s.pendingChoice,null);return;}
  assert.equal(s.pendingChoice.optional,false);
  assert.throws(()=>act(s,{type:'choose',skip:true}));
  s=act(s,{type:'choose',zone:'center'});
  if(n==='hBP01-033') assert.equal(s.players[0].zones.center.damage,10);
  else assert.equal(s.players[0].zones.center.cheer[0].id,'cheer');
 });
}
test('Pekora requires the named Oshi',()=>assert.equal(collab('hBP01-039','AUDIT-OSHI').pendingChoice,null));
test('Aki Collab healing is mandatory and may target full HP',()=>{
 let s=collab('hBP01-036');assert.equal(s.pendingChoice.optional,false);
 assert.ok(s.pendingChoice.options.includes('collab'));
 assert.throws(()=>act(s,{type:'choose',skip:true}));
 s=act(s,{type:'choose',zone:'center'});assert.equal(s.players[0].zones.center.damage,10);
});
for(const tool of [false,true]) test('Aki Arts Cheer requires tool '+tool,()=>{
 const s=state('hBP01-035');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP01-035').arts[0].cost);
 if(tool)s.players[0].zones.center.attachments=[inst('hBP02-088','tool')];
 s.players[0].cheerDeck=[inst('hY02-001','cheer')];
 let end=act(s,attack);
 if(!tool){assert.equal(end.pendingChoice,null);return;}
 assert.equal(end.pendingChoice?.type,'eventCheerTarget');assert.equal(end.pendingChoice.optional,false);
 assert.throws(()=>act(end,{type:'choose',skip:true}));
 end=act(end,{type:'choose',zone:'center'});assert.equal(end.players[0].zones.center.cheer.length,2);
});
