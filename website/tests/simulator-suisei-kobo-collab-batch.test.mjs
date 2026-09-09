import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a,d=1)=>applyAction(structuredClone(s),0,a,pool,()=> (d-.5)/6);
function start(n,center='hBP01-082'){
 const s=state(center);s.phase='main';s.players[0].zones.back1=unit(n);
 s.players[0].cheerDeck=[inst('hY04-001','cheer')];
 s.players[1].zones.back1=unit('AUDIT-DUMMY',{damage:40});
 s.players[1].zones.back2=unit('AUDIT-DUMMY',{damage:39});
 return applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>{throw Error('automatic die');});
}
for(const n of ['hBP01-080','hBP01-083']){
 test(n+' decline',()=>assert.equal(act(start(n),{type:'choose',skip:true}).pendingChoice,null));
 for(let d=1;d<=6;d++)test(n+' die '+d,()=>{
  let e=act(start(n),{type:'choose',optionId:'roll'},d);
  const hit=n==='hBP01-080'?d%2===1:d>=3;
  if(!hit){assert.equal(e.pendingChoice,null);return;}
  assert.equal(e.pendingChoice.optional,false);assert.throws(()=>act(e,{type:'choose',skip:true}));
  if(n==='hBP01-080'){
   assert.deepEqual(e.pendingChoice.options,['back1']);e=act(e,{type:'choose',zone:'back1'});
   assert.equal(e.players[1].zones.back1,null);assert.equal(e.players[1].life.length,5);
  }else{e=act(e,{type:'choose',zone:'center'});assert.equal(e.players[0].zones.center.cheer[0].id,'cheer');}
 });
}
test('Kobo requires ID center',()=>assert.equal(start('hBP01-083','AUDIT-DUMMY').pendingChoice,null));
test('Suisei blue Cheer recipient is mandatory',()=>{
 let e=start('hBP01-081');assert.equal(e.pendingChoice.optional,false);
 assert.throws(()=>act(e,{type:'choose',skip:true}));e=act(e,{type:'choose',zone:'center'});
 assert.equal(e.players[0].zones.center.cheer[0].id,'cheer');
});
