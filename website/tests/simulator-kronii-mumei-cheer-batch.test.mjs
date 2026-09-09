import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,inst,attack} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
function kronii(other=true){
 const s=state('hBP01-092');s.players[0].zones.center.cheer=[inst('hY04-001','source')];
 if(other)s.players[0].zones.back1=unit('hBP01-017');
 s.players[0].zones.back2=unit('AUDIT-DUMMY',{cheer:[inst('hY04-001','wrong')]});
 return act(s,attack);
}
test('Kronii transfers only source Cheer to other Promise',()=>{
 let s=kronii();assert.throws(()=>act(s,{type:'choose',cheerId:'wrong'}));
 s=act(s,{type:'choose',cheerId:'source'});
 assert.deepEqual(s.pendingChoice.options,['back1']);assert.throws(()=>act(s,{type:'choose',zone:'center'}));
 assert.throws(()=>act(s,{type:'choose',skip:true}));s=act(s,{type:'choose',zone:'back1'});
 assert.equal(s.players[0].zones.back1.cheer[0].id,'source');assert.equal(s.players[0].zones.center.cheer.length,0);
 assert.equal(s.players[1].zones.center.damage,10);
});
test('Kronii can decline before moving',()=>assert.equal(act(kronii(),{type:'choose',skip:true}).players[0].zones.center.cheer.length,1));
test('Kronii alone has no transfer',()=>assert.equal(kronii(false).pendingChoice,null));
for(const count of [1,2,3])test('Mumei removes up to two available center Cheer '+count,()=>{
 const s=state();s.phase='main';s.players[0].oshi=inst('hBP01-002');s.players[0].hand=[inst('hBP01-110','event')];
 s.players[1].zones.center.cheer=Array.from({length:count},(_,i)=>inst('hY04-001','c'+i));
 s.players[1].zones.back1=unit('AUDIT-DUMMY',{cheer:[inst('hY04-001','wrong')]});
 let e=act(act(s,{type:'play',cardId:'event'}),{type:'choose',optionId:'mumei'});
 e=act(e,{type:'choose',cheerId:'c0'});
 if(count>=2){assert.equal(e.pendingChoice.optional,false);assert.throws(()=>act(e,{type:'choose',skip:true}));assert.throws(()=>act(e,{type:'choose',cheerId:'wrong'}));e=act(e,{type:'choose',cheerId:'c1'});}
 assert.equal(e.players[1].zones.center.cheer.length,Math.max(0,count-2));
 assert.equal(e.players[1].zones.back1.cheer.length,1);assert.equal(e.pendingChoice,null);
});
