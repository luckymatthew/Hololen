import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
for(const available of [true,false])test('Fan meeting required search '+available,()=>{const fan=cards.find(c=>c.typeCode==='supportFan');let s=state();s.phase='main';s.players[0].hand=[inst('hBP03-089','event')];s.players[0].mainDeck=[...(available?[inst(fan.number,'yes')]:[]),inst('AUDIT-DUMMY','no')];s=applyAction(s,0,{type:'play',cardId:'event'},pool,()=>0);if(available){assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,1);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['yes']);s=applyAction(s,0,{type:'choose',cardIds:['yes']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'yes');}else assert.equal(s.pendingChoice,null);});
