import test from 'node:test';
import assert from 'node:assert/strict';
import {pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const {applyAction}=await import(process.env.HOLO_ENGINE_TEST_TARGET||'../lib/simulator/engine.mjs');
function start(){const s=state();s.phase='main';s.players[0].zones.back1=unit('hBP03-023');s.players[0].mainDeck=[inst('AUDIT-DUMMY','collabPower'),inst('hBP03-107','fan'),inst('hBP01-119','mascot'),inst('AUDIT-DUMMY','tail')];return applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);}
for(const face of [1,2,3,4,5,6])test('Pekora fan roll '+face,()=>{
 const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>(face-.5)/6);
 let e=act(start(),{type:'choose',optionId:'roll'});
 if(face%2===0){assert.deepEqual(e.pendingChoice.selectableIds,['fan']);assert.equal(e.pendingChoice.optional,false);assert.equal(e.pendingChoice.nonEmptyMin,1);assert.throws(()=>act(e,{type:'choose',skip:true}));e=act(e,{type:'choose',cardIds:['fan']});assert.equal(e.players[0].hand[0].id,'fan');}
 else {assert.equal(e.pendingChoice,null);assert.equal(e.players[0].hand.length,0);assert.equal(e.players[0].mainDeck.length,3);}
});
test('Pekora can decline without revealing or consuming the deck',()=>{
 const e=applyAction(start(),0,{type:'choose',skip:true},pool,()=>0);assert.equal(e.pendingChoice,null);assert.deepEqual(e.players[0].mainDeck.map(c=>c.id),['fan','mascot','tail']);
});
test('even result with no Fan completes and shuffles without a selection',()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP03-023');s.players[0].mainDeck=[inst('AUDIT-DUMMY','other1'),inst('hBP01-119','mascot'),inst('AUDIT-DUMMY','other2')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);const deckCountAfterCollab=s.players[0].mainDeck.length;s=applyAction(s,0,{type:'choose',optionId:'roll'},pool,()=>.25);
 assert.equal(s.pendingChoice,null);assert.equal(s.players[0].mainDeck.length,deckCountAfterCollab);assert.deepEqual(s.players[0].hand,[]);
});

