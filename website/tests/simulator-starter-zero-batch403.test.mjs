import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst} from './fixtures/simulator-audit.mjs';
for(const count of [0,1])test('Starter green SP allows zero attached from archive '+count,()=>{let s=state('hBP05-028');s.phase='main';s.players[0].oshi=inst('hSD01-002');s.players[0].holoPower=Array.from({length:3},(_,i)=>inst('AUDIT-DUMMY','p'+i));s.players[0].archive=count?[inst('hY01-001','keep')]:[];s=applyAction(s,0,{type:'spOshiSkill'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);if(count){assert.equal(s.pendingChoice.min,0);s=applyAction(s,0,{type:'choose',cardIds:[]},pool,()=>0);}assert.equal(s.players[0].zones.center.cheer.length,0);assert.equal(s.players[0].spOshiSkillUsed,true);});
