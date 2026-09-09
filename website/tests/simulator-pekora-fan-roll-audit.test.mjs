import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
function start(){const s=state();s.phase='main';s.players[0].zones.back1=unit('hBP03-023');s.players[0].mainDeck=[inst('AUDIT-DUMMY','collabPower'),inst('hBP03-107','fan'),inst('hBP01-119','mascot'),inst('AUDIT-DUMMY','tail')];return applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);}
for(const face of [1,2,3,4,5,6])test('Pekora fan roll '+face,()=>{
 const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>(face-.5)/6);
 let e=act(start(),{type:'choose',optionId:'roll'});
 if(face%2===0){assert.deepEqual(e.pendingChoice.selectableIds,['fan']);e=act(e,{type:'choose',cardIds:['fan']});assert.equal(e.players[0].hand[0].id,'fan');}
 else {assert.equal(e.pendingChoice,null);assert.equal(e.players[0].hand.length,0);assert.equal(e.players[0].mainDeck.length,3);}
});
test('Pekora can decline without revealing or consuming the deck',()=>{
 const e=applyAction(start(),0,{type:'choose',skip:true},pool,()=>0);assert.equal(e.pendingChoice,null);assert.deepEqual(e.players[0].mainDeck.map(c=>c.id),['fan','mascot','tail']);
});

