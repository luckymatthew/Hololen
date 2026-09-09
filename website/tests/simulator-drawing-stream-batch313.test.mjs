import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
test('Drawing Stream must attach cheer before recovery',()=>{
 const artist=cards.find(c=>c.group==='holomem'&&c.tags?.includes('#絵'));
 let s=state(artist.number);s.phase='main';s.players[0].hand=[inst('hBP06-089','event')];
 s.players[0].cheerDeck=[inst('hY01-001','cheer')];s.players[0].archive=[inst(artist.number,'recover')];
 s=applyAction(s,0,{type:'play',cardId:'event'},pool,()=>0);
 assert.equal(s.pendingChoice.effect,'drawingStreamCheer');assert.equal(s.pendingChoice.optional,false);
 assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));
 s=applyAction(s,0,{type:'choose',cardIds:['cheer']},pool,()=>0);
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.players[0].zones.center.cheer[0].id,'cheer');
 s=applyAction(s,0,{type:'choose',cardIds:['recover']},pool,()=>0);
 assert.ok(s.players[0].hand.some(c=>c.id==='recover'));
});
