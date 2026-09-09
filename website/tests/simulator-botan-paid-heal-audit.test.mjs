import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
function start(){const s=state();s.phase='main';s.players[0].oshi=inst('hBP03-002');s.players[0].zones.center.damage=20;s.players[0].zones.back1=unit('hBP03-017');s.players[0].cheerDeck=[inst('hY01-001','cost')];return act(s,{type:'collab',zone:'back1'});}
test('Botan paid heal is mandatory after Cheer payment',()=>{
 let e=start();e=act(e,{type:'choose',optionId:e.pendingChoice.modeOptions[0].id});
 assert.equal(e.pendingChoice.optional,false);assert.throws(()=>act(e,{type:'choose',skip:true}));
 e=act(e,{type:'choose',zone:'center'});assert.equal(e.players[0].zones.center.damage,10);assert.ok(e.players[0].archive.some(c=>c.id==='cost'));
});
test('Botan can decline payment without healing',()=>{
 const e=act(start(),{type:'choose',skip:true});assert.equal(e.players[0].zones.center.damage,20);assert.equal(e.players[0].cheerDeck.length,1);
});
