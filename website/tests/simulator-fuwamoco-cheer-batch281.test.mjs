import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const cheer of ['hY03-001','hY04-001'])test('FUWAMOCO required red blue cheer '+cheer,()=>{let s=state('hBP03-050');fund(s.players[0].zones.center,['無色','無色']);s.players[0].zones.back1=unit('AUDIT-DUMMY');s.players[0].cheerDeck=[inst(cheer,'yes'),inst('hY01-001','no')];s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.selectableIds,['yes']);s=applyAction(s,0,{type:'choose',cardIds:['yes']},pool,()=>0);assert.deepEqual(s.pendingChoice.options,['center']);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.ok(s.players[0].zones.center.cheer.some(c=>c.id==='yes'));});
