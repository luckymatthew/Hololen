import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
test('Iroha Bloom attaches one Cheer to each named Holomen',()=>{
 const lower=cards.find(c=>c.jpName==='風真いろは'&&c.stage==='1st'),s=state(lower.number);s.phase='main';
 s.players[0].hand=[inst('hBP03-024','bloom')];s.players[0].zones.back1=unit('hBP01-079');s.players[0].archive=[inst('hY01-001','a'),inst('hY02-001','b')];
 let e=act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
 e=act(e,{type:'choose',cardIds:['a']});e=act(e,{type:'choose',zone:'center'});
 assert.deepEqual(e.pendingChoice.selectableIds,['b']);
 e=act(e,{type:'choose',cardIds:['b']});e=act(e,{type:'choose',zone:'back1'});
 assert.equal(e.players[0].zones.center.cheer[0].id,'a');assert.equal(e.players[0].zones.back1.cheer[0].id,'b');assert.equal(e.players[0].archive.length,0);
});
