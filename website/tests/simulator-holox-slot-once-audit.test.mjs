import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
function start(){
 const s=state('hBP02-040');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP02-040').arts[0].cost);
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','a'),inst('hBP01-119','support'),inst('AUDIT-DUMMY','b')];return act(s,attack);
}
test('2nd holoX Slot can decline without consuming Gift',()=>{
 const e=act(start(),{type:'choose',skip:true});assert.equal(e.players[0].mainDeck.length,3);
 assert.equal(e.players[1].zones.center.damage,100);assert.equal(e.players[0].namedUsageTurns?.['gift:hBP02-040:hBP02-040'],undefined);
});
test('2nd holoX failed match consumes the turn use and cannot recover support',()=>{
 const e=act(start(),{type:'choose',optionId:'reveal'});
 assert.equal(e.pendingChoice,null);assert.equal(e.players[0].archive.length,3);assert.equal(e.players[0].hand.length,0);
 assert.equal(e.players[1].zones.center.damage,140);assert.equal(e.players[1].life.length,5);
 assert.equal(e.players[0].namedUsageTurns['gift:hBP02-040:hBP02-040'],e.turn);
});
