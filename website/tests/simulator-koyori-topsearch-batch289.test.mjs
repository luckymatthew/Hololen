import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const support of [true,false])test('Koyori required Arts top search '+support,()=>{const candidate=cards.find(c=>support?c.group==='support'&&c.tags?.includes('#こよラボ'):c.stage==='Debut'&&c.tags?.includes('#秘密結社holoX'));let s=state('hBP04-009');fund(s.players[0].zones.center,['無色']);s.players[0].mainDeck=[inst(candidate.number,'yes'),inst('AUDIT-DUMMY','wrong'),inst('AUDIT-DUMMY','wrong2'),inst(candidate.number,'outside')];s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.selectableIds,['yes']);s=applyAction(s,0,{type:'choose',cardIds:['yes']},pool,()=>0);assert.ok(s.players[0].hand.some(c=>c.id==='yes'));});
