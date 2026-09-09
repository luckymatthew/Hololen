import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const [colors,count] of [[['白'],0],[['紅'],1],[['藍'],1],[['紅','藍'],2]])test('Non-Limit Boost colors '+colors,()=>{let s=state('hBP05-037');fund(s.players[0].zones.center,colors);s.players[0].archive=[inst('hY01-001','a'),inst('hY02-001','b')];s=applyAction(s,0,attack,pool,()=>0);if(!count){assert.equal(s.pendingChoice,null);return;}assert.equal(s.pendingChoice.optional,true);assert.equal(s.pendingChoice.max,count);s=applyAction(s,0,{type:'choose',cardIds:count===2?['a','b']:['a']},pool,()=>0);while(s.pendingChoice){assert.deepEqual(s.pendingChoice.options,['center']);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}assert.equal(s.players[0].zones.center.cheer.length,colors.length+count);});
