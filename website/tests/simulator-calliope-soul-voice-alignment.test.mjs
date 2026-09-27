import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst} from './fixtures/simulator-audit.mjs';

test('Soul Voice archives the top deck card automatically, then shuffles the remainder',()=>{
 const s=state('hBP02-058');s.phase='main';
 s.players[0].hand=[inst('hBP02-059','soul-voice')];
 s.players[0].mainDeck=[inst('hBP02-067','top'),inst('hBP01-119','middle'),inst('AUDIT-DUMMY','bottom')];
 let e=applyAction(s,0,{type:'play',cardId:'soul-voice'},pool,()=>0);
 e=applyAction(e,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(e.pendingChoice,null,'the top card is not a player selection');
 assert.deepEqual(e.players[0].archive.map(card=>card.id),['top']);
 assert.deepEqual(new Set(e.players[0].mainDeck.map(card=>card.id)),new Set(['middle','bottom']));
 assert.equal(e.players[0].mainDeck.length,2);
});
