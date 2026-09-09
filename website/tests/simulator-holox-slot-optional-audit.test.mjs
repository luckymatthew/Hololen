import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
function start(){
 const s=state('hBP02-039');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP02-039').arts[0].cost);
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','a'),inst('hBP01-119','support'),inst('AUDIT-DUMMY','b'),inst('AUDIT-DUMMY','tail')];
 return act(s,attack);
}
test('holoX Slot decline leaves deck and Gift untouched',()=>{
 const e=act(start(),{type:'choose',skip:true});assert.equal(e.pendingChoice,null);
 assert.equal(e.players[0].mainDeck.length,4);assert.equal(e.players[0].archive.length,0);assert.equal(e.players[1].zones.center.damage,20);
});
for(const skip of [true,false])test('holoX Slot reveals once and resolves Gift skip '+skip,()=>{
 let e=act(start(),{type:'choose',optionId:'reveal'});assert.deepEqual(e.pendingChoice.selectableIds,['support']);
 e=act(e,skip?{type:'choose',skip:true}:{type:'choose',cardIds:['support']});
 assert.equal(e.players[1].zones.center.damage,60);assert.equal(e.players[0].mainDeck[0].id,'tail');
 assert.equal(e.players[0].archive.length,skip?3:2);assert.equal(e.players[0].hand.length,skip?0:1);
});
