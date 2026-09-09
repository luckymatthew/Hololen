import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
for(const valid of [true,false])test('Stroganoff second buff requires 2nd Choco '+valid,()=>{const debut=cards.find(c=>c.jpName==='癒月ちょこ'&&c.stage==='Debut');let s=state(debut.number);s.phase='main';s.players[0].hand=[inst('hBP05-076','event')];if(valid)s.players[0].zones.back1=unit('hBP05-056');if(!valid){assert.throws(()=>applyAction(s,0,{type:'play',cardId:'event'},pool,()=>0));return;}s=applyAction(s,0,{type:'play',cardId:'event'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.deepEqual(s.pendingChoice.options,['back1']);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.ok(s.players[0].zones.back1.modifiers.some(m=>m.kind==='arts'&&m.amount===10));});
