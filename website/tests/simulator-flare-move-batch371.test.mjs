import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
test('Flare normal Collab mandatory top three Gift',()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP07-085');s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst('AUDIT-DUMMY','a'),inst('hBP07-085','flare'),inst('AUDIT-DUMMY','b'),inst('AUDIT-DUMMY','remaining')];s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.effect,'genericTopLook');assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['flare']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'flare');assert.deepEqual(s.players[0].archive.map(c=>c.id),['a','b']);assert.equal(s.players[0].mainDeck[0].id,'remaining');
});
for(const own of [true,false])test('Flare forced movement own turn '+own,()=>{
 let s=state();s.activePlayer=own?0:1;s.players[0].zones.back1=unit('hBP07-085');s.players[0].mainDeck=[inst('hBP07-085','flare'),inst('AUDIT-DUMMY','a'),inst('AUDIT-DUMMY','b')];s.pendingChoice={type:'forcedCollab',playerIndex:0,options:['back1']};s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);if(own){assert.equal(s.pendingChoice.effect,'genericTopLook');s=applyAction(s,0,{type:'choose',cardIds:['flare']},pool,()=>0);assert.equal(s.players[0].hand.length,1);}else {assert.equal(s.pendingChoice,null);assert.equal(s.players[0].mainDeck.length,3);}
});
