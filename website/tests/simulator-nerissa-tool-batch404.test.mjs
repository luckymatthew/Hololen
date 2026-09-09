import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
test('Nerissa tool triggers after her Arts hand archive',()=>{let s=state('hBP05-061');fund(s.players[0].zones.center,['紫','無色','無色']);s.players[0].zones.center.attachments=[inst('hBP05-083','tool')];s.players[0].hand=[inst('AUDIT-DUMMY','discard')];s=applyAction(s,0,attack,pool,()=>0);s=applyAction(s,0,{type:'choose',cardIds:['discard']},pool,()=>0);assert.equal(s.pendingChoice.effect,'specialDamage');s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);s=applyAction(s,0,{type:"choose",zone:"center"},pool,()=>0);assert.equal(s.players[1].zones.center.damage,170);assert.ok(JSON.stringify(s.log).includes("20 點特殊傷害"));});
