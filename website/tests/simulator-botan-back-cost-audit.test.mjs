import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,fund,attack} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
for(const enabled of [false,true])test('Botan Arts Oshi gate '+enabled,()=>{
 const s=state('hBP03-021');s.players[0].oshi=inst(enabled?'hBP03-002':'AUDIT-OSHI');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP03-021').arts[0].cost);
 s.players[0].zones.back1=unit('AUDIT-DUMMY',{cheer:[inst('hY01-001','cost')]});s.players[1].zones.collab=unit('AUDIT-DUMMY');
 let e=act(s,attack);
 if(enabled){e=act(e,{type:'choose',optionId:e.pendingChoice.modeOptions.find(o=>o.cardId==='cost').id});assert.throws(()=>act(e,{type:'choose',skip:true}));e=act(e,{type:'choose',zone:'collab'});assert.equal(e.players[1].zones.collab.damage,40);assert.ok(e.players[0].archive.some(c=>c.id==='cost'));}
 else assert.equal(e.pendingChoice,null);
 assert.equal(e.players[1].zones.center.damage,110);
});

