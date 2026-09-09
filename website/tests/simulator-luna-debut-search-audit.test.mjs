import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
const fan=cards.find(c=>c.jpName==='ルーナイト').number;
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
function start(existing=false){
 const s=state('hBP03-009');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP03-009').arts[0].cost);
 s.players[0].zones.back1=unit('hBP03-009',{attachments:existing?[inst(fan,'existing')]:[]});
 s.players[0].mainDeck=[inst(fan,'fan'),inst('hBP01-119','wrong'),inst('AUDIT-DUMMY','tail')];return act(s,attack);
}
test('Luna Debut search unavailable when another holder has Lunaite',()=>{
 const e=start(true);assert.equal(e.pendingChoice,null);assert.equal(e.players[0].mainDeck.length,3);
});
test('Luna Debut optional search can decline',()=>{
 const e=act(start(),{type:'choose',skip:true});assert.equal(e.pendingChoice,null);assert.equal(e.players[0].mainDeck.length,3);
});
test('Luna Debut searches Lunaite then attaches',()=>{
 let e=start();assert.deepEqual(e.pendingChoice.selectableIds,['fan']);
 e=act(e,{type:'choose',cardIds:['fan']});e=act(e,{type:'choose',zone:'back1'});
 assert.equal(e.players[0].zones.back1.attachments[0].id,'fan');assert.equal(e.players[0].mainDeck.length,2);
});
