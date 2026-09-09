import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,inst,attack} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
function start(){
 const s=state('hBP01-091');s.players[0].zones.center.cheer=['hY04-001','hY02-001','hY03-001'].map((n,i)=>inst(n,'c'+i));
 s.players[0].zones.back1=unit('AUDIT-DUMMY',{cheer:[inst('hY04-001','other')]});
 s.players[1].zones.back1=unit('AUDIT-DUMMY');
 return act(s,{...attack,artIndex:1});
}
for(const id of ['c0','c1'])test('Moona pays '+id+' and must damage back',()=>{
 let s=start();assert.deepEqual(s.pendingChoice.options,['c0','c1']);
 assert.throws(()=>act(s,{type:'choose',cheerId:'c2'}));assert.throws(()=>act(s,{type:'choose',cheerId:'other'}));
 s=act(s,{type:'choose',cheerId:id});assert.equal(s.pendingChoice.optional,false);
 assert.throws(()=>act(s,{type:'choose',skip:true}));assert.throws(()=>act(s,{type:'choose',zone:'center'}));
 s=act(s,{type:'choose',zone:'back1'});assert.equal(s.players[1].zones.back1.damage,30);
 assert.equal(s.players[1].zones.center.damage,80);assert.equal(s.players[0].archive[0].id,id);
});
test('Moona may decline cost',()=>{
 const s=act(start(),{type:'choose',skip:true});assert.equal(s.players[0].zones.center.cheer.length,3);
 assert.equal(s.players[1].zones.center.damage,80);assert.equal(s.players[1].zones.back1.damage,0);
});
