import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state,fund} from './fixtures/simulator-audit.mjs';
for(const valid of [true,false])test('HOLOTORI attachment recipient required '+valid,()=>{
 const bird=cards.find(c=>c.group==='holomem'&&c.tags.includes('#トリ'));let s=state(valid?bird.number:'AUDIT-DUMMY');s.phase='main';s.players[0].hand=[inst('hBP08-099','play')];s.players[0].archive=[inst('hY01-001','cheer')];
 if(!valid){assert.throws(()=>applyAction(s,0,{type:'play',cardId:'play'},pool,()=>0));assert.equal(s.players[0].hand[0].id,'play');return;}
 s=applyAction(s,0,{type:'play',cardId:'play'},pool,()=>0);s=applyAction(s,0,{type:'choose',optionId:'attach'},pool,()=>0);s=applyAction(s,0,{type:'choose',cardIds:['cheer']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer[0].id,'cheer');
});
test('HOLOTORI draw remains usable without archive Cheer',()=>{
 const bird=cards.find(c=>c.group==='holomem'&&c.tags.includes('#トリ'));let s=state(bird.number);s.phase='main';fund(s.players[0].zones.center,['白']);s.players[0].hand=[inst('hBP08-099','play')];s=applyAction(s,0,{type:'play',cardId:'play'},pool,()=>0);assert.deepEqual(s.pendingChoice.modeOptions.map(o=>o.id),['draw']);
});

