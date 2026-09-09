import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
function setup(){const s=state('hBP08-058','hBP05-045');fund(s.players[0].zones.center,['藍','藍','無色','無色']);return s;}
test('FUWAMOCO first Arts requires blue archive selection',()=>{let s=setup();s.players[0].archive=[inst('hY04-001','a'),inst('hY01-001','b')];s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.effect,'archiveCheerToStage');assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,1);assert.throws(()=>applyAction(s,0,{type:'choose',cardIds:[]},pool));});
test('FUWAMOCO second Arts pays two before special damage',()=>{let s=setup();s.players[0].oshi=inst('hBP03-004');s=applyAction(s,0,{...attack,artIndex:1},pool,()=>0);assert.equal(s.pendingChoice.effect,'artArchiveCheerCost');s=applyAction(s,0,{type:'choose',cheerId:'cheer0',zone:'center'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cheerId:'cheer1',zone:'center'},pool,()=>0);assert.equal(s.pendingChoice.effect,'specialDamage');s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].archive.length,2);});
test('Red FUWAMOCO does not enable second Arts effect',()=>{let s=setup();s.players[0].oshi=inst('hBP08-003');s=applyAction(s,0,{...attack,artIndex:1},pool,()=>0);assert.equal(s.players[0].zones.center.cheer.length,4);assert.equal(s.pendingChoice,null);});
