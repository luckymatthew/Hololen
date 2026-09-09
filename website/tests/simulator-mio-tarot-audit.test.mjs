import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
for(const n of ['AUDIT-DUMMY','hBP01-119','hY01-001'])for(const skip of [false,true])test('Mio Tarot '+n+' skip '+skip,()=>{
 const s=state('hBP02-027');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP02-027').arts[0].cost);
 s.players[0].mainDeck=[inst(n,'top'),inst('AUDIT-DUMMY','tail')];
 let e=act(s,attack);assert.equal(e.players[0].mainDeck.length,2);
 e=act(e,skip?{type:'choose',skip:true}:{type:'choose',optionId:'archive'});
 assert.equal(e.players[1].zones.center.damage,60+(skip?0:n==='AUDIT-DUMMY'?20:n==='hBP01-119'?50:0));
 assert.equal(e.players[0].archive.some(c=>c.id==='top'),!skip);assert.equal(e.players[0].mainDeck.length,skip?2:1);
});
