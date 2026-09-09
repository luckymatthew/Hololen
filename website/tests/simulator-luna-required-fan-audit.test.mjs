import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,fund,attack} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
test('Luna Arts requires archived Lunaite and Luna recipient',()=>{
 const fan=cards.find(c=>c.jpName==='ルーナイト'),s=state('hBP03-013');
 fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP03-013').arts[0].cost);
 s.players[0].zones.back1=unit('AUDIT-DUMMY');s.players[0].archive=[inst(fan.number,'fan'),inst('hBP01-119','wrong')];
 let e=act(s,attack);assert.deepEqual(e.pendingChoice.selectableIds,['fan']);assert.throws(()=>act(e,{type:'choose',skip:true}));
 e=act(e,{type:'choose',cardIds:['fan']});assert.throws(()=>act(e,{type:'choose',zone:'back1'}));
 e=act(e,{type:'choose',zone:'center'});assert.equal(e.players[0].zones.center.attachments[0].id,'fan');assert.equal(e.players[0].archive.some(c=>c.id==='fan'),false);
});
