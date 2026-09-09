import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
test('FLOW GLOW SP covers shared Arts payment by tagged source',()=>{const original=pool.find(c=>c.number==='hBP01-081');const deck=pool.map(c=>c.number===original.number?{...c,tags:[...c.tags,'#FLOW GLOW']}:c);let s=state(original.number);fund(s.players[0].zones.center,['藍','藍','藍','藍','藍']);s.players[0].oshi=inst('hSD11-001');s.players[0].holoPower=Array.from({length:10},(_,i)=>inst('AUDIT-DUMMY','p'+i));s=applyAction(s,0,attack,deck,()=>0);s=applyAction(s,0,{type:'choose',cheerId:'cheer0'},deck,()=>0);s=applyAction(s,0,{type:'choose',cheerId:'cheer1'},deck,()=>0);assert.equal(s.pendingChoice.effect,'hSD11FlowGlowArchiveSp');assert.equal(s.pendingChoice.meta.amount,60);});
